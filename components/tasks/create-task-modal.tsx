'use client'

import { useState } from 'react'
import { useNewAuth } from '@/contexts/new-auth-context'
import { Task, TaskPriority, TaskStatus, TaskCategory } from '@/types/task'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import { EmployeeSelect } from './employee-select'
import { sendTaskAssignmentNotification } from '@/lib/notifications'

interface CreateTaskModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (task: Task) => void
}

export function CreateTaskModal({ isOpen, onClose, onSuccess }: CreateTaskModalProps) {
  const { user } = useNewAuth()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium' as TaskPriority,
    status: 'pending' as TaskStatus,
    category: 'general' as TaskCategory,
    dueDate: new Date(),
    assigneeId: '',
    assigneeName: '',
    assignerId: user?.id || '',
    assignerName: user?.name || '',
    estimatedHours: 1
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !formData.assigneeId) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      setLoading(true)
      const res = await fetch('/api/tasks', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          priority: formData.priority,
          category: formData.category,
          dueDate: formData.dueDate.toISOString(),
          estimatedHours: formData.estimatedHours,
          assignees: [
            {
              id: formData.assigneeId,
              name: formData.assigneeName,
              type: 'user',
            },
          ],
        }),
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error || 'Failed to create task')
      }

      const created = await res.json()
      const newTask: Task = {
        id: created.id,
        title: created.title,
        description: created.description || formData.description,
        assignees: created.assignees || [
          {
            id: formData.assigneeId,
            name: formData.assigneeName,
            type: 'user' as const,
          },
        ],
        assignerId: user.id,
        department: user.department,
        priority: created.priority || formData.priority,
        status: (created.status || formData.status) as TaskStatus,
        category: (created.category || formData.category) as TaskCategory,
        dueDate: created.dueDate ? new Date(created.dueDate) : formData.dueDate,
        estimatedHours: formData.estimatedHours,
        createdAt: created.createdAt ? new Date(created.createdAt) : new Date(),
        updatedAt: new Date(),
      }

      // Send notification to assigned user
      await sendTaskAssignmentNotification(formData.assigneeId, {
        title: formData.title,
        description: formData.description,
        assignedBy: user.name,
        priority: formData.priority === 'urgent' ? 'high' : formData.priority
      })

      onSuccess(newTask)
      toast.success('Task created successfully and notification sent')
      onClose()
    } catch (error) {
      console.error('Error creating task:', error)
      toast.error('Failed to create task')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter task title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter task description"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Assign To</Label>
            <EmployeeSelect
              value={formData.assigneeId}
              onChange={(id, name) => setFormData(prev => ({ 
                ...prev, 
                assigneeId: id,
                assigneeName: name
              }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value as TaskPriority }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData(prev => ({ ...prev, category: value as TaskCategory }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="development">Development</SelectItem>
                  <SelectItem value="design">Design</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="support">Support</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.dueDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.dueDate ? format(formData.dueDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.dueDate}
                    onSelect={(date) => date && setFormData(prev => ({ ...prev, dueDate: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimatedHours">Estimated Hours</Label>
              <Input
                id="estimatedHours"
                type="number"
                min="0.5"
                step="0.5"
                value={formData.estimatedHours}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  estimatedHours: parseFloat(e.target.value) 
                }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 