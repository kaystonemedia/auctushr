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
import { doc, updateDoc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from './firebase'

export type StorageProvider = 'supabase' | 'cloudinary' | 'firestore' | 'firebase'

// Configuration - using Supabase as primary provider for demo phase
const STORAGE_PROVIDER: StorageProvider = process.env.NEXT_PUBLIC_STORAGE_PROVIDER as StorageProvider || 'supabase'

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
}

class DocumentStorageService {
  private provider: StorageProvider = STORAGE_PROVIDER

  async uploadDocument(file: File, path: string, uploadedBy: string): Promise<DocumentUploadResult> {
    try {
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
        uploadedAt: new Date()
      }

      await setDoc(doc(db, 'documents', metadata.id), metadata)

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