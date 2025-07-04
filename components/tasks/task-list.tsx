'use client'

import { useState } from 'react'
import { Task, TaskPriority, TaskStatus } from '@/types/task'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { format } from 'date-fns'
import { Calendar, Clock, AlertCircle, CheckCircle, MoreVertical, Pencil, Trash, Play, Pause, ThumbsUp } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'react-hot-toast'
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { EditTaskModal } from './edit-task-modal'
import { useNewAuth } from '@/contexts/new-auth-context'
import { sendTaskCompletionNotification, sendCustomNotification } from '@/lib/notifications'

interface TaskListProps {
  tasks: Task[]
  loading: boolean
  onTaskUpdate: (task: Task) => void
  onTaskDelete: (taskId: string) => void
}

const PRIORITY_COLORS = {
  low: 'bg-blue-100 text-blue-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800'
}

const STATUS_COLORS = {
  pending: 'bg-gray-100 text-gray-800',
  accepted: 'bg-purple-100 text-purple-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800'
}

export function TaskList({ tasks, loading, onTaskUpdate, onTaskDelete }: TaskListProps) {
  const { user } = useNewAuth()
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  // Helper function to check if task is assigned to current user (smart matching)
  const isTaskAssignedToUser = (task: Task): boolean => {
    if (!user) return false
    
    // Direct assignment check (Firebase Auth UID)
    if ((task as any).assignedTo === user.id) {
      return true
    }
    
    // Smart matching: Check if assignedTo matches user's Firestore document ID
    if (user.firestoreId && (task as any).assignedTo === user.firestoreId) {
      return true
    }
    
    return false
  }

  const handleStatusChange = async (task: Task, newStatus: TaskStatus) => {
    try {
      const taskRef = doc(db, 'tasks', task.id)
      
      // Build updates object with only defined values
      const updates: any = {
        status: newStatus,
        updatedAt: new Date()
      }

      // Only set timestamp fields when transitioning to those states
      if (newStatus === 'completed') {
        updates.completedAt = new Date()
      }
      
      if (newStatus === 'accepted' && !((task as any).acceptedAt)) {
        updates.acceptedAt = new Date()
      }
      
      if (newStatus === 'in_progress' && !((task as any).startedAt)) {
        updates.startedAt = new Date()
      }

      await updateDoc(taskRef, updates)
      
      onTaskUpdate({
        ...task,
        ...updates,
        completedAt: updates.completedAt
      })
      
      // Send appropriate notifications
      const statusMessages = {
        accepted: 'Task accepted successfully',
        in_progress: 'Task started successfully', 
        completed: 'Task completed successfully',
        cancelled: 'Task cancelled',
        pending: 'Task marked as pending'
      }
      
      toast.success(statusMessages[newStatus] || 'Task status updated')
      
      // Send notifications to task assigner when status changes
      if ((task as any).assignerId && (task as any).assignerId !== user?.id) {
        try {
          if (newStatus === 'completed') {
            await sendTaskCompletionNotification((task as any).assignerId, {
              title: task.title,
              completedAt: new Date(),
              priority: task.priority
            })
          } else {
            await sendCustomNotification(
              (task as any).assignerId,
              'Task Status Update',
              `${user?.name || 'Someone'} has ${statusMessages[newStatus]?.toLowerCase()}: "${task.title}"`,
              'info'
            )
          }
        } catch (notificationError) {
          console.error('Failed to send notification:', notificationError)
          // Don't fail the status update if notification fails
        }
      }
      
    } catch (error) {
      console.error('Error updating task status:', error)
      toast.error('Failed to update task status')
    }
  }

  const handleDelete = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return

    try {
      await deleteDoc(doc(db, 'tasks', taskId))
      onTaskDelete(taskId)
      toast.success('Task deleted successfully')
    } catch (error) {
      console.error('Error deleting task:', error)
      toast.error('Failed to delete task')
    }
  }

  // Get available status transitions based on current status and user role
  const getAvailableStatusTransitions = (task: Task) => {
    const transitions = []
    
    // Check if this task is assigned to current user
    const isAssignedToUser = isTaskAssignedToUser(task)
    const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager'
    
    if (task.status === 'pending') {
      if (isAssignedToUser) {
        transitions.push({ status: 'accepted', label: 'Accept Task', icon: ThumbsUp, color: 'text-purple-600' })
      }
    }
    
    if (task.status === 'accepted') {
      if (isAssignedToUser) {
        transitions.push({ status: 'in_progress', label: 'Start Task', icon: Play, color: 'text-blue-600' })
      }
    }
    
    if (task.status === 'in_progress') {
      if (isAssignedToUser) {
        transitions.push({ status: 'completed', label: 'Complete Task', icon: CheckCircle, color: 'text-green-600' })
      }
    }
    
    // Admins and managers can change any status
    if (isAdminOrManager) {
      const allStatuses = [
        { status: 'pending', label: 'Mark Pending', icon: Clock, color: 'text-gray-600' },
        { status: 'accepted', label: 'Mark Accepted', icon: ThumbsUp, color: 'text-purple-600' },
        { status: 'in_progress', label: 'Mark In Progress', icon: Play, color: 'text-blue-600' },
        { status: 'completed', label: 'Mark Completed', icon: CheckCircle, color: 'text-green-600' },
        { status: 'cancelled', label: 'Cancel Task', icon: Pause, color: 'text-red-600' }
      ]
      return allStatuses.filter(s => s.status !== task.status)
    }
    
    return transitions
  }

  // Format status for display
  const formatStatus = (status: TaskStatus) => {
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No tasks found
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Mobile View */}
      <div className="md:hidden">
        <div className="space-y-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{task.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{task.description}</p>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ml-2 ${
                  task.status === 'completed'
                    ? 'bg-green-100 text-green-800'
                    : task.status === 'in_progress'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {task.status.replace('_', ' ')}
                </span>
              </div>
              
              <div className="space-y-2 mb-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Priority:</span>
                  <span className={`text-sm font-medium ${
                    task.priority === 'high'
                      ? 'text-red-600'
                      : task.priority === 'medium'
                      ? 'text-yellow-600'
                      : 'text-green-600'
                  }`}>
                    {task.priority}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Due Date:</span>
                  <span className="text-sm font-medium">
                    {new Date(task.dueDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Assigned To:</span>
                  <span className="text-sm font-medium">
                    {task.assignees.length > 0 ? task.assignees.map(a => a.name).join(', ') : 'Unassigned'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Department:</span>
                  <span className="text-sm font-medium">{task.department}</span>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between">
                <button
                  onClick={() => setEditingTask(task)}
                  className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(task.id)}
                  className="px-3 py-1 text-sm text-red-600 hover:text-red-800 font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop View */}
      <div className="hidden md:block">
        {tasks.map((task) => (
          <Card key={task.id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-medium">{task.title}</h3>
                    <Badge className={PRIORITY_COLORS[task.priority]}>
                      {task.priority}
                    </Badge>
                    <Badge className={STATUS_COLORS[task.status]}>
                      {formatStatus(task.status)}
                    </Badge>
                  </div>
                  {task.description && (
                    <p className="text-sm text-gray-500">{task.description}</p>
                  )}
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      {format(task.dueDate, 'MMM d, yyyy')}
                    </div>
                    {task.completedAt && (
                      <div className="flex items-center text-green-600">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Completed {format(task.completedAt, 'MMM d, yyyy')}
                      </div>
                    )}
                  </div>
                  
                  {/* Status Transition Buttons */}
                  <div className="flex items-center space-x-2 mt-2">
                    {getAvailableStatusTransitions(task).map((transition) => {
                      const IconComponent = transition.icon
                      return (
                        <Button
                          key={transition.status}
                          variant="outline"
                          size="sm"
                          className={`${transition.color} border-current hover:bg-current hover:bg-opacity-10`}
                          onClick={() => handleStatusChange(task, transition.status as TaskStatus)}
                        >
                          <IconComponent className="h-4 w-4 mr-1" />
                          {transition.label}
                        </Button>
                      )
                    })}
                    
                    {/* Show workflow hint for employees */}
                    {(isTaskAssignedToUser(task) && user?.role === 'employee') && (
                      <div className="text-xs text-gray-500 ml-4">
                        {task.status === 'pending' && 'Accept this task to start working on it'}
                        {task.status === 'accepted' && 'Start working when you\'re ready'}
                        {task.status === 'in_progress' && 'Mark as complete when finished'}
                        {task.status === 'completed' && '✓ Task completed'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {/* Edit is allowed for assigned users or admins/managers */}
                  {(isTaskAssignedToUser(task) || user?.role === 'admin' || user?.role === 'manager') && (
                    <DropdownMenuItem onClick={() => setEditingTask(task)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  {/* Delete is only allowed for admins/managers */}
                  {(user?.role === 'admin' || user?.role === 'manager') && (
                    <DropdownMenuItem
                      onClick={() => handleDelete(task.id)}
                      className="text-red-600"
                    >
                      <Trash className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </Card>
        ))}
      </div>

      {editingTask && (
        <EditTaskModal
          task={editingTask}
          isOpen={!!editingTask}
          onClose={() => setEditingTask(null)}
          onSuccess={(updatedTask) => {
            onTaskUpdate(updatedTask)
            setEditingTask(null)
          }}
        />
      )}
    </div>
  )
} 