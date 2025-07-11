"use client"

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { CheckCircle, XCircle, FileText, Calendar, User, Building2, Tag } from 'lucide-react'
import { DocumentService } from '@/lib/document-service'
import { Document, DocumentStatus, ApprovalStatus } from '@/types/document'
import { toast } from '@/components/ui/use-toast'
import { format } from 'date-fns'

interface DocumentApprovalModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  document: Document | null
  userId: string
  userRole: string
}

export function DocumentApprovalModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  document, 
  userId, 
  userRole 
}: DocumentApprovalModalProps) {
  const [comments, setComments] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const handleApprove = async () => {
    if (!document) return

    try {
      setIsProcessing(true)
      const documentService = new DocumentService()
      await documentService.approveDocument(document.id, userId, comments)
      
      toast({
        title: "Document approved",
        description: `${document.name} has been approved successfully.`
      })
      
      onSuccess()
      onClose()
    } catch (error) {
      toast({
        title: "Approval failed",
        description: error instanceof Error ? error.message : "Failed to approve document. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!document) return

    if (!comments.trim()) {
      toast({
        title: "Comments required",
        description: "Please provide a reason for rejection.",
        variant: "destructive"
      })
      return
    }

    try {
      setIsProcessing(true)
      const documentService = new DocumentService()
      await documentService.rejectDocument(document.id, userId, comments)
      
      toast({
        title: "Document rejected",
        description: `${document.name} has been rejected.`
      })
      
      onSuccess()
      onClose()
    } catch (error) {
      toast({
        title: "Rejection failed",
        description: error instanceof Error ? error.message : "Failed to reject document. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const getStatusColor = (status: DocumentStatus) => {
    switch (status) {
      case DocumentStatus.APPROVED: return 'bg-green-100 text-green-800'
      case DocumentStatus.PENDING: return 'bg-yellow-100 text-yellow-800'
      case DocumentStatus.REJECTED: return 'bg-red-100 text-red-800'
      case DocumentStatus.DRAFT: return 'bg-gray-100 text-gray-800'
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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (!document) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Document Approval</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Document Information */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-gray-500" />
              <h3 className="text-lg font-semibold">{document.name}</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">Created:</span>
                  <span>{format(document.createdAt, 'PPp')}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">Uploaded by:</span>
                  <span>{document.createdBy}</span>
                </div>
                {document.department && (
                  <div className="flex items-center space-x-2">
                    <Building2 className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-600">Department:</span>
                    <span>{document.department}</span>
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="text-gray-600">Type:</span>
                  <Badge variant="outline">{document.type.replace('_', ' ').toUpperCase()}</Badge>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-600">Category:</span>
                  <Badge variant="outline">{document.category.replace('_', ' ').toUpperCase()}</Badge>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-600">Size:</span>
                  <span>{formatFileSize(document.fileSize)}</span>
                </div>
              </div>
            </div>

            {/* Current Status */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-gray-600">Status:</span>
                <Badge className={getStatusColor(document.status)}>
                  {document.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
              {document.approvalStatus && (
                <div className="flex items-center space-x-2">
                  <span className="text-gray-600">Approval:</span>
                  <Badge className={getApprovalStatusColor(document.approvalStatus)}>
                    {document.approvalStatus.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
              )}
            </div>

            {/* Description */}
            {document.description && (
              <div className="space-y-2">
                <span className="text-gray-600 font-medium">Description:</span>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{document.description}</p>
              </div>
            )}

            {/* Tags */}
            {document.tags && document.tags.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Tag className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600 font-medium">Tags:</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {document.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Previous Approval Comments */}
            {document.approvalComments && (
              <div className="space-y-2">
                <span className="text-gray-600 font-medium">Previous Comments:</span>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{document.approvalComments}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Approval Actions */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="comments">Comments</Label>
              <Textarea
                id="comments"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Add comments about your decision (required for rejection)"
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button 
                type="button" 
                variant="destructive" 
                onClick={handleReject}
                disabled={isProcessing}
                className="flex items-center space-x-2"
              >
                <XCircle className="h-4 w-4" />
                <span>{isProcessing ? 'Rejecting...' : 'Reject'}</span>
              </Button>
              <Button 
                type="button" 
                onClick={handleApprove}
                disabled={isProcessing}
                className="flex items-center space-x-2"
              >
                <CheckCircle className="h-4 w-4" />
                <span>{isProcessing ? 'Approving...' : 'Approve'}</span>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 