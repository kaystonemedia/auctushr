import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  Timestamp,
  serverTimestamp,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore'
import { db } from './firebase'
import { documentStorage } from './document-storage'
import { sendDocumentUpdateNotification } from './notifications'
import { 
  Document, 
  DocumentFormData, 
  DocumentSearchFilters,
  DocumentAnalytics,
  DocumentActivity,
  DocumentRequest,
  DocumentTemplate,
  TemplateFormData,
  DocumentType,
  DocumentCategory,
  DocumentStatus,
  ApprovalStatus
} from '../types/document'

export class DocumentService {
  
  // ========== DOCUMENT CRUD OPERATIONS ==========
  
  async createDocument(
    file: File, 
    formData: DocumentFormData, 
    userId: string
  ): Promise<Document> {
    try {
      // Upload file to storage
      const uploadResult = await documentStorage.uploadDocument(
        file, 
        `employee-docs/${userId}/${formData.category}`,
        userId
      )

      // Create document metadata
      const documentData: Omit<Document, 'id'> = {
        name: formData.name,
        type: formData.type,
        category: formData.category,
        fileUrl: uploadResult.url,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        
        // Ownership & Access
        ownerId: userId,
        createdBy: userId,
        sharedWith: formData.sharedWith || [],
        department: formData.department,
        
        // Lifecycle
        status: 'active',
        version: 1,
        
        // Metadata
        description: formData.description,
        tags: formData.tags || [],
        expirationDate: formData.expirationDate,
        
        // Workflow
        requiresApproval: formData.requiresApproval,
        approvalStatus: formData.requiresApproval ? 'pending' : undefined,
        
        // Tracking
        createdAt: new Date(),
        updatedAt: new Date(),
        accessCount: 0,
        
        // Storage info
        storageProvider: uploadResult.provider,
        storagePath: uploadResult.path
      }

      // Save to Firestore
      const docRef = await addDoc(collection(db, 'documents'), documentData)
      const document = { id: docRef.id, ...documentData }

      // Log activity
      await this.logActivity(document.id, userId, 'created', `Document "${document.name}" created`)

      // Send notifications
      if (formData.sharedWith && formData.sharedWith.length > 0) {
        for (const employeeId of formData.sharedWith) {
          await sendDocumentUpdateNotification(employeeId, {
            title: document.name,
            updatedBy: userId,
            updateType: 'created'
          })
        }
      }

      return document
    } catch (error) {
      console.error('Error creating document:', error)
      throw error
    }
  }

  async getDocument(documentId: string, userId: string): Promise<Document | null> {
    try {
      const docRef = doc(db, 'documents', documentId)
      const docSnap = await getDoc(docRef)

      if (!docSnap.exists()) {
        return null
      }

      const document = { id: docSnap.id, ...docSnap.data() } as Document

      // Check access permissions
      if (!this.canAccessDocument(document, userId)) {
        throw new Error('Access denied')
      }

      // Update access count and last accessed
      await updateDoc(docRef, {
        accessCount: document.accessCount + 1,
        lastAccessedAt: serverTimestamp()
      })

      // Log activity
      await this.logActivity(documentId, userId, 'viewed', `Document "${document.name}" viewed`)

      return document
    } catch (error) {
      console.error('Error getting document:', error)
      throw error
    }
  }

  async updateDocument(
    documentId: string, 
    updates: Partial<DocumentFormData>, 
    userId: string
  ): Promise<Document> {
    try {
      const docRef = doc(db, 'documents', documentId)
      const docSnap = await getDoc(docRef)

      if (!docSnap.exists()) {
        throw new Error('Document not found')
      }

      const document = { id: docSnap.id, ...docSnap.data() } as Document

      // Check permissions
      if (!this.canEditDocument(document, userId)) {
        throw new Error('Edit access denied')
      }

      // Prepare updates
      const updateData = {
        ...updates,
        updatedAt: serverTimestamp(),
        version: document.version + 1
      }

      // Update document
      await updateDoc(docRef, updateData)

      // Log activity
      await this.logActivity(documentId, userId, 'edited', `Document "${document.name}" updated`)

      // Get updated document
      const updatedDoc = await this.getDocument(documentId, userId)
      return updatedDoc!
    } catch (error) {
      console.error('Error updating document:', error)
      throw error
    }
  }

  async deleteDocument(documentId: string, userId: string): Promise<void> {
    try {
      const docRef = doc(db, 'documents', documentId)
      const docSnap = await getDoc(docRef)

      if (!docSnap.exists()) {
        throw new Error('Document not found')
      }

      const document = { id: docSnap.id, ...docSnap.data() } as Document

      // Check permissions
      if (!this.canDeleteDocument(document, userId)) {
        throw new Error('Delete access denied')
      }

      // Delete from storage
      await documentStorage.deleteDocument(documentId)

      // Delete from Firestore
      await deleteDoc(docRef)

      // Log activity
      await this.logActivity(documentId, userId, 'deleted', `Document "${document.name}" deleted`)

    } catch (error) {
      console.error('Error deleting document:', error)
      throw error
    }
  }

  // ========== DOCUMENT SEARCH & LISTING ==========

  async searchDocuments(
    searchTerm: string, 
    filters: DocumentSearchFilters, 
    userId: string,
    pageSize: number = 20,
    lastDoc?: QueryDocumentSnapshot<DocumentData>
  ): Promise<{ documents: Document[], hasMore: boolean, lastDoc?: QueryDocumentSnapshot<DocumentData> }> {
    try {
      let q = query(collection(db, 'documents'))

      // Add filters
      if (filters.category && filters.category.length > 0) {
        q = query(q, where('category', 'in', filters.category))
      }

      if (filters.type && filters.type.length > 0) {
        q = query(q, where('type', 'in', filters.type))
      }

      if (filters.status && filters.status.length > 0) {
        q = query(q, where('status', 'in', filters.status))
      }

      if (filters.ownerId) {
        q = query(q, where('ownerId', '==', filters.ownerId))
      }

      if (filters.department) {
        q = query(q, where('department', '==', filters.department))
      }

      // Add ordering and pagination
      q = query(q, orderBy('createdAt', 'desc'), limit(pageSize))

      if (lastDoc) {
        q = query(q, startAfter(lastDoc))
      }

      const querySnapshot = await getDocs(q)
      const documents: Document[] = []

      querySnapshot.forEach((doc) => {
        const document = { id: doc.id, ...doc.data() } as Document
        
        // Check access permissions
        if (this.canAccessDocument(document, userId)) {
          // Apply text search if provided
          if (!searchTerm || this.matchesSearchTerm(document, searchTerm)) {
            documents.push(document)
          }
        }
      })

      const hasMore = querySnapshot.docs.length === pageSize
      const newLastDoc = querySnapshot.docs[querySnapshot.docs.length - 1]

      return { documents, hasMore, lastDoc: newLastDoc }
    } catch (error) {
      console.error('Error searching documents:', error)
      throw error
    }
  }

  async getUserDocuments(userId: string, category?: DocumentCategory): Promise<Document[]> {
    try {
      let q = query(
        collection(db, 'documents'),
        where('ownerId', '==', userId),
        orderBy('createdAt', 'desc')
      )

      if (category) {
        q = query(q, where('category', '==', category))
      }

      const querySnapshot = await getDocs(q)
      const documents: Document[] = []

      querySnapshot.forEach((doc) => {
        documents.push({ id: doc.id, ...doc.data() } as Document)
      })

      return documents
    } catch (error) {
      console.error('Error getting user documents:', error)
      throw error
    }
  }

  // ========== DOCUMENT SHARING ==========

  async shareDocument(
    documentId: string, 
    shareWithIds: string[], 
    userId: string
  ): Promise<void> {
    try {
      const docRef = doc(db, 'documents', documentId)
      const docSnap = await getDoc(docRef)

      if (!docSnap.exists()) {
        throw new Error('Document not found')
      }

      const document = { id: docSnap.id, ...docSnap.data() } as Document

      // Check permissions
      if (!this.canShareDocument(document, userId)) {
        throw new Error('Share access denied')
      }

      // Update shared list
      const currentSharedWith = document.sharedWith || []
      const newSharedWith = [...new Set([...currentSharedWith, ...shareWithIds])]

      await updateDoc(docRef, {
        sharedWith: newSharedWith,
        updatedAt: serverTimestamp()
      })

      // Send notifications
      for (const employeeId of shareWithIds) {
        if (!currentSharedWith.includes(employeeId)) {
          await sendDocumentUpdateNotification(employeeId, {
            title: document.name,
            updatedBy: userId,
            updateType: 'created'
          })
        }
      }

      // Log activity
      await this.logActivity(documentId, userId, 'shared', `Document shared with ${shareWithIds.length} users`)

    } catch (error) {
      console.error('Error sharing document:', error)
      throw error
    }
  }

  // ========== DOCUMENT APPROVAL WORKFLOW ==========

  async approveDocument(
    documentId: string, 
    userId: string, 
    comments?: string
  ): Promise<void> {
    try {
      const docRef = doc(db, 'documents', documentId)
      await updateDoc(docRef, {
        approvalStatus: 'approved',
        approvedBy: userId,
        approvedAt: serverTimestamp(),
        approvalComments: comments,
        updatedAt: serverTimestamp()
      })

      // Log activity
      await this.logActivity(documentId, userId, 'approved', `Document approved${comments ? `: ${comments}` : ''}`)

    } catch (error) {
      console.error('Error approving document:', error)
      throw error
    }
  }

  async rejectDocument(
    documentId: string, 
    userId: string, 
    comments: string
  ): Promise<void> {
    try {
      const docRef = doc(db, 'documents', documentId)
      await updateDoc(docRef, {
        approvalStatus: 'rejected',
        approvedBy: userId,
        approvedAt: serverTimestamp(),
        approvalComments: comments,
        updatedAt: serverTimestamp()
      })

      // Log activity
      await this.logActivity(documentId, userId, 'rejected', `Document rejected: ${comments}`)

    } catch (error) {
      console.error('Error rejecting document:', error)
      throw error
    }
  }

  // ========== DOCUMENT ANALYTICS ==========

  async getDocumentAnalytics(userId?: string): Promise<DocumentAnalytics> {
    try {
      let q = query(collection(db, 'documents'))
      
      if (userId) {
        q = query(q, where('ownerId', '==', userId))
      }

      const querySnapshot = await getDocs(q)
      const documents: Document[] = []

      querySnapshot.forEach((doc) => {
        documents.push({ id: doc.id, ...doc.data() } as Document)
      })

      // Calculate analytics
      const analytics: DocumentAnalytics = {
        totalDocuments: documents.length,
        documentsByCategory: this.groupByCategory(documents),
        documentsByType: this.groupByType(documents),
        documentsByStatus: this.groupByStatus(documents),
        recentActivity: [], // This would come from activity log
        topAccessedDocuments: documents.sort((a, b) => b.accessCount - a.accessCount).slice(0, 10),
        expiringDocuments: documents.filter(doc => 
          doc.expirationDate && doc.expirationDate <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        ),
        pendingApprovals: [], // This would come from approval requests
        storageUsage: {
          totalSize: documents.reduce((sum, doc) => sum + doc.fileSize, 0),
          byProvider: documents.reduce((acc, doc) => {
            const provider = doc.storageProvider || 'unknown'
            acc[provider] = (acc[provider] || 0) + doc.fileSize
            return acc
          }, {} as Record<string, number>)
        }
      }

      return analytics
    } catch (error) {
      console.error('Error getting document analytics:', error)
      throw error
    }
  }

  // ========== UTILITY METHODS ==========

  private canAccessDocument(document: Document, userId: string): boolean {
    return (
      document.ownerId === userId ||
      document.sharedWith?.includes(userId) ||
      document.createdBy === userId
    )
  }

  private canEditDocument(document: Document, userId: string): boolean {
    return (
      document.ownerId === userId ||
      document.createdBy === userId
    )
  }

  private canDeleteDocument(document: Document, userId: string): boolean {
    return (
      document.ownerId === userId ||
      document.createdBy === userId
    )
  }

  private canShareDocument(document: Document, userId: string): boolean {
    return (
      document.ownerId === userId ||
      document.createdBy === userId
    )
  }

  private matchesSearchTerm(document: Document, searchTerm: string): boolean {
    const term = searchTerm.toLowerCase()
    return (
      document.name.toLowerCase().includes(term) ||
      document.description?.toLowerCase().includes(term) ||
      document.tags.some(tag => tag.toLowerCase().includes(term))
    )
  }

  private groupByCategory(documents: Document[]): Record<DocumentCategory, number> {
    return documents.reduce((acc, doc) => {
      acc[doc.category] = (acc[doc.category] || 0) + 1
      return acc
    }, {} as Record<DocumentCategory, number>)
  }

  private groupByType(documents: Document[]): Record<DocumentType, number> {
    return documents.reduce((acc, doc) => {
      acc[doc.type] = (acc[doc.type] || 0) + 1
      return acc
    }, {} as Record<DocumentType, number>)
  }

  private groupByStatus(documents: Document[]): Record<DocumentStatus, number> {
    return documents.reduce((acc, doc) => {
      acc[doc.status] = (acc[doc.status] || 0) + 1
      return acc
    }, {} as Record<DocumentStatus, number>)
  }

  private async logActivity(
    documentId: string, 
    userId: string, 
    action: string, 
    details?: string
  ): Promise<void> {
    try {
      const activity: Omit<DocumentActivity, 'id'> = {
        documentId,
        userId,
        userName: 'User', // You can fetch actual user name
        action: action as any,
        details,
        timestamp: new Date(),
        ipAddress: '', // You can capture this from request
        userAgent: '' // You can capture this from request
      }

      await addDoc(collection(db, 'document_activities'), activity)
    } catch (error) {
      console.error('Error logging document activity:', error)
      // Don't throw here, as this is just logging
    }
  }
}

// Export singleton instance
export const documentService = new DocumentService()

// Export for easy access
export const {
  createDocument,
  getDocument,
  updateDocument,
  deleteDocument,
  searchDocuments,
  getUserDocuments,
  shareDocument,
  approveDocument,
  rejectDocument,
  getDocumentAnalytics
} = documentService 