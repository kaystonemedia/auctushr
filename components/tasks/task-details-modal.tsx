'use client'

import { useState } from 'react'
import { Task, TaskComment } from '@/types/task'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { useToast } from '@/components/ui/use-toast'
import { doc, updateDoc, arrayUnion } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useNewAuth } from '@/contexts/new-auth-context'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

interface TaskDetailsModalProps {
  task: Task
  isOpen: boolean
  onClose: () => void
  onTaskUpdate: (task: Task) => void
}

export function TaskDetailsModal({ task, isOpen, onClose, onTaskUpdate }: TaskDetailsModalProps) {
  const { user } = useNewAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [comment, setComment] = useState('')

  // Helper function to get assignee display text
  const getAssigneeDisplay = () => {
    if (!task.assignees || task.assignees.length === 0) {
      return 'Unassigned'
    }
    
    if (task.assignees.length === 1) {
      return task.assignees[0].name
    }
    
    // Multiple assignees
    return task.assignees.map(assignee => assignee.name).join(', ')
  }

  // Helper function to format due date safely
  const formatDueDate = (date: Date) => {
    try {
      return format(date instanceof Date ? date : new Date(date), 'PPP')
    } catch (error) {
      return 'Invalid date'
    }
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !comment.trim()) return

    try {
      setLoading(true)

      const newComment: TaskComment = {
        id: crypto.randomUUID(),
        userId: user.id,
        userName: user.name || user.email || 'Unknown User',
        content: comment.trim(),
        createdAt: new Date()
      }

      const taskRef = doc(db, 'tasks', task.id)
      await updateDoc(taskRef, {
        comments: arrayUnion(newComment),
        updatedAt: new Date()
      })

      const updatedTask = {
        ...task,
        comments: [...(task.comments || []), newComment],
        updatedAt: new Date()
      }

      onTaskUpdate(updatedTask)
      setComment('')
      toast({
        title: 'Success',
        description: 'Comment added successfully',
      })
    } catch (error) {
      console.error('Error adding comment:', error)
      toast({
        title: 'Error',
        description: 'Failed to add comment',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'low': return 'bg-gray-100 text-gray-800'
      case 'medium': return 'bg-blue-100 text-blue-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'urgent': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Task Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold">{task.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Assignee{task.assignees && task.assignees.length > 1 ? 's' : ''}</h4>
              <p className="mt-1">{getAssigneeDisplay()}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Assigned By</h4>
              <p className="mt-1">{task.assignerName || 'Unknown'}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
              <Badge className={getStatusColor(task.status)}>
                {task.status.replace('_', ' ')}
              </Badge>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Priority</h4>
              <Badge className={getPriorityColor(task.priority)}>
                {task.priority}
              </Badge>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Category</h4>
              <Badge variant="outline" className="mt-1">
                {task.category}
              </Badge>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Due Date</h4>
              <p className="mt-1">{formatDueDate(task.dueDate)}</p>
            </div>
            {task.estimatedHours && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Estimated Hours</h4>
                <p className="mt-1">{task.estimatedHours} hours</p>
              </div>
            )}
            {task.actualHours && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Actual Hours</h4>
                <p className="mt-1">{task.actualHours} hours</p>
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="font-medium">Comments</h4>
            <ScrollArea className="h-[200px] rounded-md border p-4">
              {task.comments && task.comments.length > 0 ? (
                <div className="space-y-4">
                  {task.comments.map((comment) => (
                    <div key={comment.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{comment.userName}</span>
                        <span className="text-sm text-muted-foreground">
                          {format(comment.createdAt, 'PPp')}
                        </span>
                      </div>
                      <p className="text-sm">{comment.content}</p>
                      {comment.attachments && comment.attachments.length > 0 && (
                        <div className="flex gap-2 mt-2">
                          {comment.attachments.map((attachment, index) => (
                            <a
                              key={index}
                              href={attachment}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline"
                            >
                              Attachment {index + 1}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No comments yet
                </p>
              )}
            </ScrollArea>

            <form onSubmit={handleAddComment} className="space-y-2">
              <Textarea
                placeholder="Add a comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                disabled={loading}
                rows={3}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={loading || !comment.trim()}>
                  {loading ? 'Adding...' : 'Add Comment'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 