import { useState, useEffect } from 'react'
import { useNewAuth } from '@/contexts/new-auth-context'
import { ProductivityService } from '@/lib/productivity'
import { TaskRecord, ProductivitySettings } from '@/types/productivity'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Clock, CheckCircle, AlertCircle, Calendar, Tag, User } from 'lucide-react'
import { format } from 'date-fns'

const DEFAULT_SETTINGS: ProductivitySettings = {
  trackingEnabled: true,
  idleThreshold: 300, // 5 minutes in seconds
  syncInterval: 60000, // 1 minute in milliseconds
  collectUrls: true,
  collectTitles: true,
  retentionPeriod: 90, // days
  productiveDomains: ['github.com', 'stackoverflow.com', 'docs.google.com', 'notion.so'],
  productiveSites: ['github.com', 'stackoverflow.com', 'docs.google.com', 'notion.so'],
  unproductiveSites: ['facebook.com', 'twitter.com', 'instagram.com', 'youtube.com'],
  workingHours: {
    start: '09:00',
    end: '17:00'
  },
  breakDuration: 5, // minutes
  targetProductiveHours: 6, // hours
  focusSessionDuration: 25, // minutes
  maxFocusSessionsPerDay: 8,
  minFocusTimePercentage: 60, // 60%
  maxMeetingTimePercentage: 30, // 30%
  productivityThresholds: {
    low: 40,
    medium: 70,
    high: 90
  },
  notificationPreferences: {
    focusReminders: true,
    breakReminders: true,
    productivityAlerts: true,
    meetingReminders: true
  }
}

const PRIORITY_COLORS = {
  low: 'bg-blue-500',
  medium: 'bg-yellow-500',
  high: 'bg-red-500'
}

const STATUS_COLORS = {
  pending: 'bg-gray-500',
  in_progress: 'bg-blue-500',
  completed: 'bg-green-500',
  blocked: 'bg-red-500'
}

export function TaskManager() {
  const { user } = useNewAuth()
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null)
  const [newTask, setNewTask] = useState<{
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    estimatedHours: number;
    startTime: string;
    tags: string[];
  }>({
    title: '',
    description: '',
    priority: 'medium',
    estimatedHours: 1,
    startTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    tags: []
  })
  const [filter, setFilter] = useState({
    status: 'all',
    priority: 'all',
    search: ''
  })

  useEffect(() => {
    if (user) {
      fetchTasks()
    }
  }, [user])

  const fetchTasks = async () => {
    try {
      setLoading(true)
      // Mock tasks for demo purposes
      const mockTasks = [
        { id: '1', title: 'Demo Task 1', completed: false, timeSpent: 30 },
        { id: '2', title: 'Demo Task 2', completed: true, timeSpent: 45 }
      ]
      setTasks(mockTasks as any)
      // const service = ProductivityService.getInstance(DEFAULT_SETTINGS)
      // const userTasks = await service.getTasks(user!.uid, new Date(), new Date())
      // setTasks(userTasks)
    } catch (error) {
      console.error('Error fetching tasks:', error)
      toast.error('Failed to fetch tasks')
    } finally {
      setLoading(false)
    }
  }

  const createTask = async () => {
    if (!user || !newTask.title) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      setLoading(true)
      const service = ProductivityService.getInstance(DEFAULT_SETTINGS, DEFAULT_SETTINGS)
      await service.createTask({
        ...newTask,
        assignedTo: (user as any).uid,
        assignedBy: (user as any).uid,
        status: 'pending',
        startTime: new Date(newTask.startTime)
      })
      toast.success('Task created successfully')
      setIsDialogOpen(false)
      setNewTask({
        title: '',
        description: '',
        priority: 'medium',
        estimatedHours: 1,
        startTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        tags: []
      })
      fetchTasks()
    } catch (error) {
      console.error('Error creating task:', error)
      toast.error('Failed to create task')
    } finally {
      setLoading(false)
    }
  }

  const updateTaskStatus = async (taskId: string, status: TaskRecord['status']) => {
    try {
      setLoading(true)
      const service = ProductivityService.getInstance(DEFAULT_SETTINGS, DEFAULT_SETTINGS)
      await service.updateTask(taskId, { status })
      toast.success('Task status updated')
      fetchTasks()
    } catch (error) {
      console.error('Error updating task status:', error)
      toast.error('Failed to update task status')
    } finally {
      setLoading(false)
    }
  }

  const filteredTasks = tasks.filter(task => {
    if (filter.status !== 'all' && task.status !== filter.status) return false
    if (filter.priority !== 'all' && task.priority !== filter.priority) return false
    if (filter.search && !task.title.toLowerCase().includes(filter.search.toLowerCase())) return false
    return true
  })

  const getTaskProgress = (task: TaskRecord) => {
    if (!task.actualHours) return 0
    return Math.min((task.actualHours / task.estimatedHours) * 100, 100)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Tasks</h2>
          <p className="text-sm text-muted-foreground">
            Manage your tasks and track their progress
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
              <DialogDescription>
                Add a new task to your productivity tracker
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="Enter task title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Enter task description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={newTask.priority}
                    onValueChange={(value: 'low' | 'medium' | 'high') =>
                      setNewTask({ ...newTask, priority: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estimatedHours">Estimated Hours</Label>
                  <Input
                    id="estimatedHours"
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={newTask.estimatedHours}
                    onChange={(e) =>
                      setNewTask({ ...newTask, estimatedHours: parseFloat(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="datetime-local"
                  value={newTask.startTime}
                  onChange={(e) => setNewTask({ ...newTask, startTime: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createTask} disabled={loading}>
                Create Task
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center space-x-4">
        <Input
          placeholder="Search tasks..."
          value={filter.search}
          onChange={(e) => setFilter({ ...filter, search: e.target.value })}
          className="max-w-sm"
        />
        <Select
          value={filter.status}
          onValueChange={(value) => setFilter({ ...filter, status: value })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filter.priority}
          onValueChange={(value) => setFilter({ ...filter, priority: value })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No Tasks Found</h3>
          <p className="mt-2 text-sm text-gray-500">
            {filter.search || filter.status !== 'all' || filter.priority !== 'all'
              ? 'Try adjusting your filters'
              : 'Create a new task to get started'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredTasks.map((task) => (
            <Card key={task.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{task.title}</CardTitle>
                    <CardDescription className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {format(new Date(task.startTime), 'MMM d, yyyy h:mm a')}
                      </span>
                      {task.endTime && (
                        <>
                          <span>→</span>
                          <span>
                            {format(new Date(task.endTime), 'MMM d, yyyy h:mm a')}
                          </span>
                        </>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={PRIORITY_COLORS[task.priority]}>
                      {task.priority}
                    </Badge>
                    <Badge className={STATUS_COLORS[task.status]}>
                      {task.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {task.description && (
                    <p className="text-sm text-muted-foreground">{task.description}</p>
                  )}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Progress</span>
                      <span>{Math.round(getTaskProgress(task))}%</span>
                    </div>
                    <Progress value={getTaskProgress(task)} />
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center">
                        <Clock className="mr-1 h-4 w-4" />
                        <span>
                          {task.actualHours || 0}h / {task.estimatedHours}h
                        </span>
                      </div>
                      {task.assignedTo && (
                        <div className="flex items-center">
                          <User className="mr-1 h-4 w-4" />
                          <span>Assigned to you</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {task.tags && task.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {task.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          <Tag className="mr-1 h-3 w-3" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <div className="flex items-center space-x-2">
                  {task.status === 'pending' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateTaskStatus(task.id, 'in_progress')}
                    >
                      Start Task
                    </Button>
                  )}
                  {task.status === 'in_progress' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateTaskStatus(task.id, 'completed')}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Complete
                    </Button>
                  )}
                  {task.status === 'blocked' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateTaskStatus(task.id, 'in_progress')}
                    >
                      Unblock
                    </Button>
                  )}
                </div>
                {task.status !== 'completed' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => updateTaskStatus(task.id, 'blocked')}
                  >
                    <AlertCircle className="mr-2 h-4 w-4" />
                    Block
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
} 