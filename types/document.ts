export interface Document {
  id: string
  name: string
  type: DocumentType
  category: DocumentCategory
  fileUrl: string
  fileName: string
  fileSize: number
  mimeType: string
  
  // Ownership & Access
  ownerId: string // Employee ID
  createdBy: string // Who uploaded it
  sharedWith: string[] // Employee IDs with access
  department?: string // Department restriction
  
  // Lifecycle
  status: DocumentStatus
  version: number
  previousVersionId?: string
  
  // Metadata
  description?: string
  tags: string[]
  expirationDate?: Date
  verifiedBy?: string
  verifiedAt?: Date
  
  // Workflow
  requiresApproval: boolean
  approvalStatus?: ApprovalStatus
  approvedBy?: string
  approvedAt?: Date
  approvalComments?: string
  
  // Tracking
  createdAt: Date
  updatedAt: Date
  lastAccessedAt?: Date
  accessCount: number
  
  // Storage provider info
  storageProvider?: 'supabase' | 'cloudinary' | 'firestore' | 'firebase'
  storagePath?: string
}

export enum DocumentType {
  CONTRACT = 'contract',
  POLICY = 'policy',
  HANDBOOK = 'handbook',
  FORM = 'form',
  IDENTIFICATION = 'identification',
  VISA = 'visa',
  LICENSE = 'license',
  PERFORMANCE_REVIEW = 'performance_review',
  TRAINING_CERTIFICATE = 'training_certificate',
  OFFER_LETTER = 'offer_letter',
  TERMINATION_LETTER = 'termination_letter',
  EMERGENCY_CONTACT = 'emergency_contact',
  TAX_FORM = 'tax_form',
  NDA = 'nda',
  RESIGNATION_LETTER = 'resignation_letter',
  MISCELLANEOUS = 'miscellaneous'
}

export enum DocumentCategory {
  PERSONAL = 'personal',
  COMPANY = 'company',
  COMPLIANCE = 'compliance',
  ONBOARDING = 'onboarding',
  PERFORMANCE = 'performance',
  LEGAL = 'legal',
  HR_ADMIN = 'hr_admin',
  PAYROLL = 'payroll'
}

export enum DocumentStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  EXPIRED = 'expired',
  PENDING = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  REVISION_REQUESTED = 'revision_requested'
}

export interface DocumentTemplate {
  id: string
  name: string
  description: string
  category: DocumentCategory
  type: DocumentType
  content: string // Template content with variables
  variables: TemplateVariable[]
  
  // Access control
  availableToRoles: ('admin' | 'manager' | 'employee')[]
  availableToDepartments?: string[]
  
  // Workflow
  requiresApproval: boolean
  approvalFlow?: ApprovalFlow
  
  // Metadata
  createdBy: string
  createdAt: Date
  updatedAt: Date
  version: number
  isActive: boolean
}

export interface TemplateVariable {
  name: string
  type: 'string' | 'number' | 'date' | 'boolean' | 'email' | 'currency'
  required: boolean
  defaultValue?: string | number | boolean
  description?: string
  validation?: {
    min?: number
    max?: number
    pattern?: string
  }
}

export interface ApprovalFlow {
  steps: ApprovalStep[]
  requiresAllApprovals: boolean // true = all must approve, false = any can approve
}

export interface ApprovalStep {
  id: string
  name: string
  approverType: 'role' | 'specific_user' | 'department_head' | 'manager'
  approverValue: string // role name, user ID, or department
  order: number
  isOptional: boolean
}

export interface DocumentRequest {
  id: string
  documentId: string
  documentName: string
  requestedBy: string
  requestedFor: string // Employee ID
  requestType: 'access' | 'signature' | 'approval' | 'update'
  
  // Status
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  priority: 'low' | 'medium' | 'high'
  
  // Metadata
  reason?: string
  dueDate?: Date
  comments?: string
  
  // Workflow
  approvalFlow?: ApprovalFlow
  currentStep?: number
  approvers: DocumentApprover[]
  
  // Tracking
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
}

export interface DocumentApprover {
  userId: string
  userName: string
  userRole: string
  status: 'pending' | 'approved' | 'rejected'
  comments?: string
  approvedAt?: Date
}

export interface DocumentShare {
  id: string
  documentId: string
  sharedBy: string
  sharedWith: string
  sharedAt: Date
  expiresAt?: Date
  permissions: DocumentPermission[]
  accessCount: number
  lastAccessedAt?: Date
}

export type DocumentPermission = 
  | 'view'
  | 'download'
  | 'comment'
  | 'edit'
  | 'delete'
  | 'share'

export interface DocumentActivity {
  id: string
  documentId: string
  userId: string
  userName: string
  action: DocumentAction
  details?: string
  timestamp: Date
  ipAddress?: string
  userAgent?: string
}

export type DocumentAction = 
  | 'created'
  | 'uploaded'
  | 'viewed'
  | 'downloaded'
  | 'edited'
  | 'deleted'
  | 'shared'
  | 'approved'
  | 'rejected'
  | 'commented'
  | 'signed'
  | 'archived'

export interface DocumentFolder {
  id: string
  name: string
  description?: string
  parentId?: string // For nested folders
  path: string // Full path like /HR/Policies/Safety
  
  // Access control
  ownerId: string
  sharedWith: string[]
  permissions: Record<string, DocumentPermission[]>
  
  // Metadata
  createdBy: string
  createdAt: Date
  updatedAt: Date
  documentCount: number
  subfolderCount: number
}

export interface DocumentSearchResult {
  document: Document
  relevanceScore: number
  matchedFields: string[]
  highlights: Record<string, string[]>
}

export interface DocumentSearchFilters {
  category?: DocumentCategory[]
  type?: DocumentType[]
  status?: DocumentStatus[]
  ownerId?: string
  department?: string
  tags?: string[]
  dateRange?: {
    start: Date
    end: Date
    field: 'createdAt' | 'updatedAt' | 'expirationDate'
  }
  hasExpiration?: boolean
  requiresApproval?: boolean
  approvalStatus?: ApprovalStatus[]
}

export interface DocumentAnalytics {
  totalDocuments: number
  documentsByCategory: Record<DocumentCategory, number>
  documentsByType: Record<DocumentType, number>
  documentsByStatus: Record<DocumentStatus, number>
  recentActivity: DocumentActivity[]
  topAccessedDocuments: Document[]
  expiringDocuments: Document[]
  pendingApprovals: DocumentRequest[]
  storageUsage: {
    totalSize: number
    byProvider: Record<string, number>
  }
}

// Form interfaces for UI components
export interface DocumentFormData {
  name: string
  type: DocumentType
  category: DocumentCategory
  description?: string
  tags: string[]
  expirationDate?: Date
  requiresApproval: boolean
  sharedWith: string[]
  department?: string
}

export interface TemplateFormData {
  name: string
  description: string
  category: DocumentCategory
  type: DocumentType
  content: string
  variables: TemplateVariable[]
  availableToRoles: ('admin' | 'manager' | 'employee')[]
  availableToDepartments?: string[]
  requiresApproval: boolean
} 