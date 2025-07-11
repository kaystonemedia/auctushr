"use client"

import { useState, useEffect } from 'react'
import { useNewAuth } from '@/contexts/new-auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { DocumentService } from '@/lib/document-service'
import { Document, DocumentType, DocumentCategory, DocumentStatus, ApprovalStatus } from '@/types/document'
import { 
  Upload, 
  Download, 
  Eye, 
  Edit, 
  Trash2, 
  Search, 
  Filter, 
  Plus, 
  FileText, 
  Calendar, 
  User, 
  Building2, 
  CheckCircle, 
  Clock, 
  XCircle, 
  Share2, 
  Star, 
  MoreVertical,
  Grid,
  List,
  AlertCircle
} from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/use-toast'
import { format } from 'date-fns'
import { DocumentUploadModal } from '@/components/documents/document-upload-modal'
import { DocumentApprovalModal } from '@/components/documents/document-approval-modal'

export default function DocumentsPage() {
  const { user, isLoading } = useNewAuth()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory | 'all'>('all')
  const [selectedStatus, setSelectedStatus] = useState<DocumentStatus | 'all'>('all')
  const [selectedType, setSelectedType] = useState<DocumentType | 'all'>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)

  useEffect(() => {
    if (user?.id) {
      loadDocuments()
    }
  }, [user])

  const loadDocuments = async () => {
    try {
      setLoading(true)
      const documentService = new DocumentService()
      
      // Get user's documents based on role
      let docs: Document[]
      if (user?.role === 'admin') {
        // Admin can see all documents
        const result = await documentService.searchDocuments('', {}, user!.id)
        docs = result.documents
      } else {
        // Regular users see their own documents
        docs = await documentService.getUserDocuments(user!.id)
      }
      
      setDocuments(docs)
    } catch (error) {
      console.error('Error loading documents:', error)
      toast({
        title: "Error loading documents",
        description: "Failed to load documents. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (document: Document) => {
    try {
      // Open the document URL in a new tab
      window.open(document.fileUrl, '_blank')
      
      // Update access count
      const documentService = new DocumentService()
      await documentService.getDocument(document.id, user!.id)
      
      // Refresh the document list to update access count
      await loadDocuments()
    } catch (error) {
      console.error('Error downloading document:', error)
      toast({
        title: "Download failed",
        description: "Failed to download document. Please try again.",
        variant: "destructive"
      })
    }
  }

  const handleDelete = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return
    }

    try {
      const documentService = new DocumentService()
      await documentService.deleteDocument(documentId, user!.id)
      toast({
        title: "Document deleted",
        description: "Document has been successfully deleted."
      })
      await loadDocuments()
    } catch (error) {
      console.error('Error deleting document:', error)
      toast({
        title: "Delete failed",
        description: "Failed to delete document. Please try again.",
        variant: "destructive"
      })
    }
  }

  const handleApproval = (document: Document) => {
    setSelectedDocument(document)
    setShowApprovalModal(true)
  }

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (doc.description && doc.description.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory
    const matchesStatus = selectedStatus === 'all' || doc.status === selectedStatus
    const matchesType = selectedType === 'all' || doc.type === selectedType
    
    return matchesSearch && matchesCategory && matchesStatus && matchesType
  })

  const getStatusColor = (status: DocumentStatus) => {
    switch (status) {
      case DocumentStatus.APPROVED: return 'bg-green-100 text-green-800'
      case DocumentStatus.PENDING: return 'bg-yellow-100 text-yellow-800'
      case DocumentStatus.REJECTED: return 'bg-red-100 text-red-800'
      case DocumentStatus.DRAFT: return 'bg-gray-100 text-gray-800'
      case DocumentStatus.ACTIVE: return 'bg-blue-100 text-blue-800'
      case DocumentStatus.ARCHIVED: return 'bg-gray-100 text-gray-800'
      case DocumentStatus.EXPIRED: return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getApprovalStatusColor = (status: ApprovalStatus) => {
    switch (status) {
      case ApprovalStatus.APPROVED: return 'bg-green-100 text-green-800'
      case ApprovalStatus.PENDING: return 'bg-yellow-100 text-yellow-800'
      case ApprovalStatus.REJECTED: return 'bg-red-100 text-red-800'
      case ApprovalStatus.REVISION_REQUESTED: return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: DocumentStatus) => {
    switch (status) {
      case DocumentStatus.APPROVED: return <CheckCircle className="h-4 w-4" />
      case DocumentStatus.PENDING: return <Clock className="h-4 w-4" />
      case DocumentStatus.REJECTED: return <XCircle className="h-4 w-4" />
      case DocumentStatus.EXPIRED: return <AlertCircle className="h-4 w-4" />
      default: return null
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const canApprove = (document: Document) => {
    return (user?.role === 'admin' || user?.role === 'manager') && 
           document.requiresApproval && 
           document.approvalStatus === ApprovalStatus.PENDING
  }

  const canDelete = (document: Document) => {
    return user?.role === 'admin' || document.ownerId === user?.id
  }

  const canEdit = (document: Document) => {
    return user?.role === 'admin' || document.ownerId === user?.id
  }

  // Calculate statistics
  const stats = {
    total: documents.length,
    pending: documents.filter(d => d.approvalStatus === ApprovalStatus.PENDING).length,
    approved: documents.filter(d => d.status === DocumentStatus.APPROVED).length,
    rejected: documents.filter(d => d.status === DocumentStatus.REJECTED).length,
    active: documents.filter(d => d.status === DocumentStatus.ACTIVE).length,
    expired: documents.filter(d => d.status === DocumentStatus.EXPIRED).length
  }

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Access Denied</h1>
          <p className="mt-2 text-gray-600">You must be signed in to view this page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-600 mt-1">Manage your documents and files</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => setShowUploadModal(true)} className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Upload Document</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-2xl font-bold text-blue-600">{stats.active}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Rejected</p>
                <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Expired</p>
                <p className="text-2xl font-bold text-orange-600">{stats.expired}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as DocumentCategory | 'all')}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.values(DocumentCategory).map((category) => (
              <SelectItem key={category} value={category}>
                {category.replace('_', ' ').toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedType} onValueChange={(value) => setSelectedType(value as DocumentType | 'all')}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.values(DocumentType).map((type) => (
              <SelectItem key={type} value={type}>
                {type.replace('_', ' ').toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as DocumentStatus | 'all')}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.values(DocumentStatus).map((status) => (
              <SelectItem key={status} value={status}>
                {status.replace('_', ' ').toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Documents Display */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading documents...</p>
          </div>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No documents found</h3>
          <p className="text-gray-600 mb-4">
            {documents.length === 0 
              ? "Upload your first document to get started" 
              : "Try adjusting your filters or search term"}
          </p>
          {documents.length === 0 && (
            <Button onClick={() => setShowUploadModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          )}
        </div>
      ) : (
        <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
          {filteredDocuments.map((document) => (
            <Card key={document.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{document.name}</h3>
                      <p className="text-sm text-gray-500">{formatFileSize(document.fileSize)}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleDownload(document)}>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </DropdownMenuItem>
                      {canApprove(document) && (
                        <DropdownMenuItem onClick={() => handleApproval(document)}>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Review
                        </DropdownMenuItem>
                      )}
                      {canDelete(document) && (
                        <DropdownMenuItem 
                          onClick={() => handleDelete(document.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-xs">
                      {document.type.replace('_', ' ').toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {document.category.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Badge className={getStatusColor(document.status)}>
                      {getStatusIcon(document.status)}
                      <span className="ml-1">{document.status.replace('_', ' ').toUpperCase()}</span>
                    </Badge>
                    {document.approvalStatus && (
                      <Badge className={getApprovalStatusColor(document.approvalStatus)}>
                        {document.approvalStatus.replace('_', ' ').toUpperCase()}
                      </Badge>
                    )}
                  </div>

                  {document.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">{document.description}</p>
                  )}

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Created {format(document.createdAt, 'MMM d, yyyy')}</span>
                    <span>Views: {document.accessCount}</span>
                  </div>

                  {document.tags && document.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {document.tags.slice(0, 3).map((tag, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {document.tags.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{document.tags.length - 3} more
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <DocumentUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={loadDocuments}
        userId={user.uid}
        userRole={user.role || 'employee'}
      />

      {/* Approval Modal */}
      <DocumentApprovalModal
        isOpen={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        onSuccess={loadDocuments}
        document={selectedDocument}
        userId={user.uid}
        userRole={user.role || 'employee'}
      />
    </div>
  )
} 