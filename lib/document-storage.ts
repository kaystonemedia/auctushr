/**
 * Configurable Document Storage Service
 * 
 * This service provides a unified interface for document storage
 * that can easily switch between different storage providers.
 * 
 * Providers supported:
 * - supabase: Free 1GB storage
 * - cloudinary: Free 25GB storage (great for images/PDFs)
 * - firestore: Small files stored as base64 in Firestore
 * - firebase: Firebase Storage (requires Blaze plan)
 */

import { uploadFile as supabaseUpload, deleteFile as supabaseDelete, getFileUrl as supabaseGetUrl } from './supabase-storage'
// import { uploadFile as cloudinaryUpload, deleteFile as cloudinaryDelete, getFileUrl as cloudinaryGetUrl } from './cloudinary-storage'
import { doc, updateDoc, getDoc, setDoc, deleteDoc, collection, query, where, orderBy, getDocs, limit } from '@/lib/data/firestore'
import { db } from './firebase'
import { safeLogAudit } from '@/lib/audit'

export type StorageProvider = 'supabase' | 'cloudinary' | 'firestore' | 'firebase'

// Configuration - using Supabase as primary provider for demo phase
const STORAGE_PROVIDER: StorageProvider = process.env.NEXT_PUBLIC_STORAGE_PROVIDER as StorageProvider || 'supabase'

// File validation constants
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const ALLOWED_MIME_TYPES = [
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // Text
  'text/plain',
  'text/csv',
  // Archives
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed'
]

export interface UploadOptions {
  ownerId?: string
  department?: string
}

export interface DocumentUploadResult {
  url: string
  path: string
  size: number
  type: string
  provider: StorageProvider
}

export interface DocumentMetadata {
  id: string
  name: string
  size: number
  type: string
  url: string
  path: string
  provider: StorageProvider
  uploadedBy: string
  uploadedAt: Date
  lastAccessed?: Date
  // Ownership & Access
  ownerId?: string // Employee ID who owns this document
  department?: string // Department restriction
  version?: number // Version number for re-uploads
  previousVersionId?: string // Link to previous version
}

class DocumentStorageService {
  private provider: StorageProvider = STORAGE_PROVIDER

  /**
   * Validate file before upload
   */
  private validateFile(file: File): void {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`)
    }

    // Check MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new Error(`File type "${file.type}" is not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`)
    }

    // Additional validation: check file extension as fallback
    const fileExtension = file.name.split('.').pop()?.toLowerCase()
    const allowedExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'txt', 'csv', 'zip', 'rar']
    if (fileExtension && !allowedExtensions.includes(fileExtension)) {
      throw new Error(`File extension ".${fileExtension}" is not allowed`)
    }
  }

  async uploadDocument(file: File, path: string, uploadedBy: string, options: UploadOptions = {}): Promise<DocumentUploadResult> {
    try {
      // Validate file
      this.validateFile(file)

      let url: string
      let filePath: string

      switch (this.provider) {
        case 'supabase':
          url = await supabaseUpload(file, path)
          filePath = `${path}/${file.name}`
          break

        case 'cloudinary':
          // url = await cloudinaryUpload(file, path)
          // filePath = `${path}/${file.name}`
          throw new Error('Cloudinary provider not configured. Please use Supabase or install cloudinary package.')
          break

        case 'firestore':
          // For small files (< 1MB), store as base64 in Firestore
          if (file.size > 1024 * 1024) {
            throw new Error('File too large for Firestore storage. Use Supabase or Cloudinary for larger files.')
          }
          url = await this.uploadToFirestore(file, path)
          filePath = `${path}/${file.name}`
          break

        case 'firebase':
          // This would be used when upgraded to Blaze plan
          throw new Error('Firebase Storage requires Blaze plan. Use Supabase or Cloudinary for now.')

        default:
          throw new Error(`Unsupported storage provider: ${this.provider}`)
      }

      const result: DocumentUploadResult = {
        url,
        path: filePath,
        size: file.size,
        type: file.type,
        provider: this.provider
      }

      // Check if this is a re-upload (same name, same owner)
      let version = 1
      let previousVersionId: string | undefined = undefined
      if (options.ownerId) {
        const existingQuery = query(
          collection(db, 'documents'),
          where('name', '==', file.name),
          where('ownerId', '==', options.ownerId),
          orderBy('version', 'desc'),
          limit(1)
        )
        const existingSnapshot = await getDocs(existingQuery)
        if (!existingSnapshot.empty) {
          const existingDoc = existingSnapshot.docs[0].data() as DocumentMetadata
          version = (existingDoc.version || 1) + 1
          previousVersionId = existingDoc.id
        }
      }

      // Store metadata in Firestore
      const metadata: DocumentMetadata = {
        id: this.generateDocumentId(),
        name: file.name,
        size: file.size,
        type: file.type,
        url,
        path: filePath,
        provider: this.provider,
        uploadedBy,
        uploadedAt: new Date(),
        ownerId: options.ownerId || uploadedBy, // Default to uploader if not specified
        department: options.department,
        version,
        previousVersionId
      }

      await setDoc(doc(db, 'documents', metadata.id), metadata)

      // Audit: document upload
      await safeLogAudit('document.upload', {
        actorId: uploadedBy,
        targetType: 'document',
        targetId: metadata.id,
        outcome: 'success',
        metadata: {
          path: filePath,
          provider: this.provider,
          size: file.size,
          type: file.type,
          ownerId: metadata.ownerId,
          department: metadata.department,
          version: metadata.version,
          previousVersionId: metadata.previousVersionId
        }
      })

      return result
    } catch (error) {
      console.error('Error uploading document:', error)
      throw error
    }
  }

  async deleteDocument(documentId: string): Promise<void> {
    try {
      // Get document metadata
      const docRef = doc(db, 'documents', documentId)
      const docSnap = await getDoc(docRef)

      if (!docSnap.exists()) {
        throw new Error('Document not found')
      }

      const metadata = docSnap.data() as DocumentMetadata

      // Delete from storage provider
      switch (metadata.provider) {
        case 'supabase':
          await supabaseDelete(metadata.path)
          break

        case 'cloudinary':
          // await cloudinaryDelete(metadata.path)
          throw new Error('Cloudinary provider not configured.')
          break

        case 'firestore':
          // Already stored in Firestore, will be deleted below
          break

        case 'firebase':
          // Implementation for Firebase Storage
          break
      }

      // Delete metadata from Firestore
      await deleteDoc(docRef)

      // Audit: document delete (actor unknown at this level)
      await safeLogAudit('document.delete', {
        targetType: 'document',
        targetId: documentId,
        outcome: 'success',
        metadata: {
          provider: metadata.provider,
          path: metadata.path
        }
      })
    } catch (error) {
      console.error('Error deleting document:', error)
      throw error
    }
  }

  async getDocumentUrl(documentId: string): Promise<string> {
    try {
      const docRef = doc(db, 'documents', documentId)
      const docSnap = await getDoc(docRef)

      if (!docSnap.exists()) {
        throw new Error('Document not found')
      }

      const metadata = docSnap.data() as DocumentMetadata

      // Update last accessed time
      await updateDoc(docRef, {
        lastAccessed: new Date()
      })

      return metadata.url
    } catch (error) {
      console.error('Error getting document URL:', error)
      throw error
    }
  }

  async getDocumentMetadata(documentId: string): Promise<DocumentMetadata | null> {
    try {
      const docRef = doc(db, 'documents', documentId)
      const docSnap = await getDoc(docRef)

      if (!docSnap.exists()) {
        return null
      }

      return docSnap.data() as DocumentMetadata
    } catch (error) {
      console.error('Error getting document metadata:', error)
      throw error
    }
  }

  private async uploadToFirestore(file: File, path: string): Promise<string> {
    try {
      // Convert file to base64
      const buffer = await file.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      const dataUrl = `data:${file.type};base64,${base64}`

      // Store in Firestore
      const docId = this.generateDocumentId()
      const docRef = doc(db, 'file_storage', docId)

      await setDoc(docRef, {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        data: base64,
        path: path,
        createdAt: new Date()
      })

      // Return a reference URL
      return `firestore://file_storage/${docId}`
    } catch (error) {
      console.error('Error uploading to Firestore:', error)
      throw error
    }
  }

  private generateDocumentId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substring(2)}`
  }

  // Helper method to get file from Firestore (for firestore provider)
  async getFileFromFirestore(documentId: string): Promise<Blob> {
    try {
      const docRef = doc(db, 'file_storage', documentId)
      const docSnap = await getDoc(docRef)

      if (!docSnap.exists()) {
        throw new Error('File not found in Firestore')
      }

      const data = docSnap.data()
      const base64Data = data.data
      const byteCharacters = atob(base64Data)
      const byteNumbers = new Array(byteCharacters.length)

      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }

      const byteArray = new Uint8Array(byteNumbers)
      return new Blob([byteArray], { type: data.fileType })
    } catch (error) {
      console.error('Error getting file from Firestore:', error)
      throw error
    }
  }

  // Migration helper - when ready to move to Firebase Storage
  async migrateToFirebaseStorage(documentId: string): Promise<void> {
    // Implementation for migrating from current provider to Firebase Storage
    // This will be useful when upgrading to Blaze plan
    console.log('Migration to Firebase Storage not yet implemented')
  }
}

export const documentStorage = new DocumentStorageService()

// Export for easy access
export const {
  uploadDocument,
  deleteDocument,
  getDocumentUrl,
  getDocumentMetadata
} = documentStorage 