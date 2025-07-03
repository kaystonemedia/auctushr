'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Task, TaskFilter } from '@/types/task'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus } from 'lucide-react'
import { collection, query, where, getDocs, orderBy, Timestamp, and } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useToast } from '@/components/ui/use-toast'
import { CreateTaskModal } from '@/components/tasks/create-task-modal'
import { TaskList } from '@/components/tasks/task-list'
import { TaskStats } from '@/components/tasks/task-stats'
import { TaskFilters } from '@/components/tasks/task-filters'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function TasksPage() {
  const { user } = useAuth()
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
      const tasksRef = collection(db, 'tasks')
      
      // Build filters array
      const filtersArray = []
      
      // Apply filters
      if (filters.status?.length) {
        filtersArray.push(where('status', 'in', filters.status))
      }
      if (filters.priority?.length) {
        filtersArray.push(where('priority', 'in', filters.priority))
      }
      if (filters.category?.length) {
        filtersArray.push(where('category', 'in', filters.category))
      }
      if (filters.assigneeId) {
        filtersArray.push(where('assigneeId', '==', filters.assigneeId))
      }
      if (filters.assignerId) {
        filtersArray.push(where('assignerId', '==', filters.assignerId))
      }
      if (dateRange.from) {
        filtersArray.push(where('dueDate', '>=', Timestamp.fromDate(dateRange.from)))
      }
      if (dateRange.to) {
        filtersArray.push(where('dueDate', '<=', Timestamp.fromDate(dateRange.to)))
      }

      // Build query with proper structure
      let q
      if (filtersArray.length > 0) {
        q = query(tasksRef, and(...filtersArray), orderBy('dueDate', 'asc'))
      } else {
        q = query(tasksRef, orderBy('dueDate', 'asc'))
      }

      const querySnapshot = await getDocs(q)
      const tasksData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        dueDate: doc.data().dueDate.toDate(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt.toDate(),
        completedAt: doc.data().completedAt?.toDate()
      })) as Task[]

      // Apply search filter if exists
      const filteredTasks = filters.search
        ? tasksData.filter(task =>
            task.title.toLowerCase().includes(filters.search!.toLowerCase()) ||
            task.description.toLowerCase().includes(filters.search!.toLowerCase())
          )
        : tasksData

      setTasks(filteredTasks)
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
        <h1 className="text-3xl font-bold">Task Management</h1>
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