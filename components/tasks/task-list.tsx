'use client'

import { useState } from 'react'
import { Task, TaskPriority, TaskStatus } from '@/types/task'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { format } from 'date-fns'
import { Calendar, Clock, AlertCircle, CheckCircle, MoreVertical, Pencil, Trash } from 'lucide-react'
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
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800'
}

export function TaskList({ tasks, loading, onTaskUpdate, onTaskDelete }: TaskListProps) {
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  const handleStatusChange = async (task: Task, newStatus: TaskStatus) => {
    try {
      const taskRef = doc(db, 'tasks', task.id)
      const updates = {
        status: newStatus,
        updatedAt: new Date(),
        completedAt: newStatus === 'completed' ? new Date() : null
      }
      await updateDoc(taskRef, updates)
      
      onTaskUpdate({
        ...task,
        ...updates,
        completedAt: updates.completedAt
      })
      
      toast.success('Task status updated')
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
      {tasks.map((task) => (
        <Card key={task.id} className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <Checkbox
                checked={task.status === 'completed'}
                onCheckedChange={(checked) => {
                  handleStatusChange(task, checked ? 'completed' : 'pending')
                }}
                className="mt-1"
              />
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <h3 className="font-medium">{task.title}</h3>
                  <Badge className={PRIORITY_COLORS[task.priority]}>
                    {task.priority}
                  </Badge>
                  <Badge className={STATUS_COLORS[task.status]}>
                    {task.status.replace('_', ' ')}
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
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditingTask(task)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleDelete(task.id)}
                  className="text-red-600"
                >
                  <Trash className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Card>
      ))}

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