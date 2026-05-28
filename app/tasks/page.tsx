'use client'

import { useState, useEffect } from 'react'
import { useNewAuth } from '@/contexts/new-auth-context'
import { Task, TaskFilter } from '@/types/task'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { CreateTaskModal } from '@/components/tasks/create-task-modal'
import { TaskList } from '@/components/tasks/task-list'
import { TaskStats } from '@/components/tasks/task-stats'
import { TaskFilters } from '@/components/tasks/task-filters'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function TasksPage() {
  const { user } = useNewAuth()
  const { toast } = useToast()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [filters, setFilters] = useState<TaskFilter>({})
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({})

  useEffect(() => {
    fetchTasks()
  }, [user, filters])

  const fetchTasks = async () => {
    if (!user) return

    try {
      setLoading(true)
      const params = new URLSearchParams({ limit: '100' })
      if (filters.status?.length) params.set('status', filters.status[0])
      if (filters.priority?.length) params.set('priority', filters.priority[0])
      if (filters.assigneeId) params.set('assigneeId', filters.assigneeId)
      if (filters.search) params.set('search', filters.search)

      const res = await fetch(`/api/tasks?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch tasks')
      const data = await res.json()

      let tasksData = (data.tasks || []).map((task: Task) => ({
        ...task,
        dueDate: task.dueDate ? new Date(task.dueDate) : new Date(),
        createdAt: task.createdAt ? new Date(task.createdAt) : new Date(),
        updatedAt: task.updatedAt ? new Date(task.updatedAt) : new Date(),
        completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
      })) as Task[]

      if (filters.status && filters.status.length > 1) {
        tasksData = tasksData.filter((t) => filters.status!.includes(t.status))
      }
      if (filters.priority && filters.priority.length > 1) {
        tasksData = tasksData.filter((t) => filters.priority!.includes(t.priority))
      }
      if (dateRange.from) {
        tasksData = tasksData.filter((t) => t.dueDate >= dateRange.from!)
      }
      if (dateRange.to) {
        tasksData = tasksData.filter((t) => t.dueDate <= dateRange.to!)
      }

      setTasks(tasksData)
    } catch (error) {
      console.error('Error fetching tasks:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch tasks',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleTaskCreated = (newTask: Task) => {
    setTasks(prev => [newTask, ...prev])
    setShowCreateModal(false)
  }

  const handleTaskUpdated = (updatedTask: Task) => {
    setTasks(prev => prev.map(task => task.id === updatedTask.id ? updatedTask : task))
  }

  const handleTaskDeleted = (taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId))
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Task Management</h1>
          <p className="text-muted-foreground mt-1">
            <a href="/productivity" className="text-primary hover:underline">
              Try the enhanced task management interface →
            </a>
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Task
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="md:col-span-3">
          <CardHeader>
            <TaskFilters
              filters={filters}
              dateRange={dateRange}
              onFilterChange={setFilters}
              onDateRangeChange={setDateRange}
            />
          </CardHeader>
          <CardContent>
            <TaskList
              tasks={tasks}
              loading={loading}
              onTaskUpdate={handleTaskUpdated}
              onTaskDelete={handleTaskDeleted}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <TaskStats tasks={tasks} />
        </div>
      </div>

      <CreateTaskModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleTaskCreated}
      />
    </div>
  )
} 