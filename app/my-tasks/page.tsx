'use client'

import { useState, useEffect } from 'react'
import { useNewAuth } from '@/contexts/new-auth-context'
import { TaskList } from '@/components/tasks/task-list'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Task, TaskStatus } from '@/types/task'
import { CheckCircle, Clock, Play, ThumbsUp, ListTodo, TrendingUp } from 'lucide-react'

interface TaskStats {
  total: number
  pending: number
  accepted: number
  inProgress: number
  completed: number
  overdue: number
}

export default function MyTasksPage() {
  const { user } = useNewAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<TaskStats>({
    total: 0,
    pending: 0,
    accepted: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0
  })
  const [activeTab, setActiveTab] = useState('all')

  const loadTasks = async () => {
    if (!user?.id) return
    try {
      setLoading(true)
      const res = await fetch(`/api/tasks?assigneeId=${user.id}&limit=100`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to load tasks')
      const data = await res.json()
      const tasksData = (data.tasks || []).map((task: Task) => ({
        ...task,
        dueDate: task.dueDate ? new Date(task.dueDate) : new Date(),
        createdAt: task.createdAt ? new Date(task.createdAt) : new Date(),
        updatedAt: task.updatedAt ? new Date(task.updatedAt) : new Date(),
        completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
      })) as Task[]
      tasksData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      setTasks(tasksData)
      calculateStats(tasksData)
    } catch (error) {
      console.error('Error fetching user tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user?.id) return
    loadTasks()
    const interval = setInterval(loadTasks, 45_000)
    return () => clearInterval(interval)
  }, [user?.id])

  const calculateStats = (tasks: Task[]) => {
    const now = new Date()
    const stats: TaskStats = {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      accepted: tasks.filter(t => t.status === 'accepted').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      overdue: tasks.filter(t => t.dueDate < now && t.status !== 'completed').length
    }
    setStats(stats)
  }

  const handleTaskUpdate = (updatedTask: Task) => {
    setTasks((prev) => {
      const next = prev.map((task) => (task.id === updatedTask.id ? updatedTask : task))
      calculateStats(next)
      return next
    })
  }

  const handleTaskDelete = (taskId: string) => {
    setTasks((prev) => {
      const next = prev.filter((task) => task.id !== taskId)
      calculateStats(next)
      return next
    })
  }

  const getFilteredTasks = () => {
    switch (activeTab) {
      case 'pending':
        return tasks.filter(t => t.status === 'pending')
      case 'active':
        return tasks.filter(t => t.status === 'accepted' || t.status === 'in_progress')
      case 'completed':
        return tasks.filter(t => t.status === 'completed')
      case 'overdue':
        const now = new Date()
        return tasks.filter(t => t.dueDate < now && t.status !== 'completed')
      default:
        return tasks
    }
  }

  const getCompletionRate = () => {
    if (stats.total === 0) return 0
    return Math.round((stats.completed / stats.total) * 100)
  }

  if (!user) {
    return <div>Please log in to view your tasks.</div>
  }

  if (user.role !== 'employee') {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-gray-500">
              This page is designed for employees. As a {user.role}, you can access the full productivity dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Tasks</h1>
        <p className="text-muted-foreground">
          View and manage your assigned tasks
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <ListTodo className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Accepted</CardTitle>
            <ThumbsUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.accepted}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{getCompletionRate()}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Overdue Alert */}
      {stats.overdue > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Badge variant="destructive">{stats.overdue}</Badge>
              <span className="text-red-700">
                {stats.overdue === 1 ? 'task is' : 'tasks are'} overdue. Please prioritize these tasks.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Task Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">
            All ({stats.total})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending ({stats.pending})
          </TabsTrigger>
          <TabsTrigger value="active">
            Active ({stats.accepted + stats.inProgress})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({stats.completed})
          </TabsTrigger>
          <TabsTrigger value="overdue" className={stats.overdue > 0 ? 'text-red-600' : ''}>
            Overdue ({stats.overdue})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {activeTab === 'all' && 'All Tasks'}
                {activeTab === 'pending' && 'Pending Tasks'}
                {activeTab === 'active' && 'Active Tasks'}
                {activeTab === 'completed' && 'Completed Tasks'}
                {activeTab === 'overdue' && 'Overdue Tasks'}
              </CardTitle>
              <CardDescription>
                {activeTab === 'pending' && 'Tasks waiting for your acceptance'}
                {activeTab === 'active' && 'Tasks you\'re currently working on'}
                {activeTab === 'completed' && 'Tasks you\'ve completed'}
                {activeTab === 'overdue' && 'Tasks that need immediate attention'}
                {activeTab === 'all' && 'All your assigned tasks'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TaskList
                tasks={getFilteredTasks()}
                loading={loading}
                onTaskUpdate={handleTaskUpdate}
                onTaskDelete={handleTaskDelete}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Help Text */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <h3 className="font-medium text-blue-900 mb-2">Task Workflow</h3>
          <div className="text-sm text-blue-700 space-y-1">
            <p><strong>Pending:</strong> New tasks assigned to you - click "Accept Task" to start</p>
            <p><strong>Accepted:</strong> Tasks you've accepted - click "Start Task" when ready to work</p>
            <p><strong>In Progress:</strong> Tasks you're actively working on - click "Complete Task" when finished</p>
            <p><strong>Completed:</strong> Tasks you've finished - well done! 🎉</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 