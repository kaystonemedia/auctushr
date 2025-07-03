'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Check, ChevronsUpDown, Users, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "react-hot-toast"
import { collection, query, where, getDocs, addDoc, updateDoc, doc, orderBy, limit, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useNewAuth } from '@/contexts/new-auth-context'
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { Clock, Target, CheckCircle, Activity, Calendar, MapPin, AlertTriangle } from 'lucide-react'
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProductivityService } from '@/lib/productivity'
import { ProductivityAnalytics, ProductivitySettings } from '@/types/productivity'
import { Calendar as CalendarIcon } from '@/components/ui/calendar'
import { Progress } from '@/components/ui/progress'
import { TrendingUp, AlertCircle } from 'lucide-react'
import { TaskList } from '@/components/tasks/task-list'
import { CreateTaskModal } from '@/components/tasks/create-task-modal'
import { Task } from '@/types/task'
import { TaskProgressCards } from '@/components/ui/task-progress-cards'

interface ActivityData {
  timestamp: string
  type: string
  duration?: number
  location?: {
    latitude: number
    longitude: number
    accuracy: number
  }
  deviceInfo?: {
    userAgent: string
    platform: string
    language: string
    screenResolution: string
  }
  flags?: Array<{
    type: string
    timestamp: string
    severity: 'low' | 'medium' | 'high'
    details?: any
  }>
}

interface ProductivityStats {
  focusTime: number
  idleTime: number
  breakTime: number
  meetingTime: number
  taskProgress: number
  topWebsites: Array<{
    domain: string
    time: number
    visits: number
  }>
  activityByHour: Array<{
    hour: number
    active: number
    idle: number
  }>
  meetings: Array<{
    title: string
    startTime: string
    endTime: string
    duration: number
  }>
  tasks: Array<{
    title: string
    completed: boolean
    timeSpent: number
  }>
  locationHistory: Array<{
    latitude: number
    longitude: number
    timestamp: string
  }>
  flags: Array<{
    type: string
    timestamp: string
    severity: 'low' | 'medium' | 'high'
    details?: any
  }>
}

interface Employee {
  id: string
  name: string
  email: string
  role: string
  department?: string
}

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

export function ProductivityDashboard() {
  const { user } = useNewAuth()
  const [analytics, setAnalytics] = useState<ProductivityAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<{
    from: Date
    to: Date
  }>({
    from: new Date(new Date().setDate(new Date().getDate() - 7)), // Last 7 days
    to: new Date()
  })
  const [activeTab, setActiveTab] = useState('overview')
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskStats, setTaskStats] = useState({
    totalIssued: 0,
    completed: 0,
    accepted: 0,
    pending: 0,
  })
  const [employeeTasks, setEmployeeTasks] = useState([])

  useEffect(() => {
    if (!user?.id) {
      setLoading(false)
      return
    }
    console.log('useEffect triggered - fetching data for user:', user.id)
    Promise.all([fetchAnalytics(), fetchTaskStats()]).finally(() => setLoading(false))
  }, [user, dateRange])

  const fetchAnalytics = async () => {
    if (!user?.id) {
      console.error('User ID is required')
      return
    }

    try {
      setLoading(true)
      const service = ProductivityService.getInstance(DEFAULT_SETTINGS, DEFAULT_SETTINGS)
      const data = await service.calculateProductivityAnalytics(
        user.id,
        dateRange.from,
        dateRange.to
      )
      setAnalytics(data)
    } catch (error) {
      console.error('Error fetching productivity analytics:', error)
      toast.error('Failed to fetch productivity analytics')
    } finally {
      setLoading(false)
    }
  }

  const fetchTaskStats = async () => {
    if (!user?.id) {
      console.log('No user ID available for fetching tasks')
      return
    }

    try {
      console.log('Fetching tasks for user:', user.id, 'role:', user?.role)
      
      // Fetch tasks based on user role
      let tasksQuery
      if (user?.role === 'admin') {
        tasksQuery = collection(db, 'tasks')
      } else if (user?.role === 'manager') {
        // Get team members first from employees collection
        const teamSnap = await getDocs(query(collection(db, 'employees'), where('managerId', '==', user.id)))
        const teamIds = teamSnap.docs.map(doc => doc.id)
        console.log('Manager team IDs:', teamIds)
        
        if (teamIds.length > 0) {
          tasksQuery = query(collection(db, 'tasks'), where('assignedTo', 'in', teamIds))
        } else {
          // If no team members, also include tasks assigned to the manager directly
          tasksQuery = query(collection(db, 'tasks'), where('assignedTo', '==', user.id))
        }
      } else {
        tasksQuery = query(collection(db, 'tasks'), where('assignedTo', '==', user.id))
      }

      const tasksSnap = await getDocs(tasksQuery)
      const tasks = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      
      console.log('Fetched tasks:', tasks.length, tasks)

      // Calculate stats
      const stats = {
        totalIssued: tasks.length,
        completed: tasks.filter(t => (t as any).status === 'completed').length,
        accepted: tasks.filter(t => (t as any).status === 'accepted').length,
        pending: tasks.filter(t => (t as any).status === 'pending').length,
        inProgress: tasks.filter(t => (t as any).status === 'in_progress').length,
      }
      console.log('Task stats:', stats)
      setTaskStats(stats)

      // Normalize task data - ensure assignedTo field exists
      const normalizedTasks = tasks.map(task => {
        const taskData = task as any
        if (!taskData.assignedTo && taskData.assigneeId) {
          taskData.assignedTo = taskData.assigneeId
        }
        return taskData
      })

      // Get employee tasks for the progress list
      const employeeTasksData = await Promise.all(
        normalizedTasks
          .filter(t => (t as any).status !== 'completed')
          .filter(t => (t as any).assignedTo && typeof (t as any).assignedTo === 'string' && (t as any).assignedTo.trim() !== '')
          .map(async (task) => {
            try {
              // Try to get user from employees collection first, then users
              let userData = null
              try {
                const empSnap = await getDoc(doc(db, 'employees', (task as any).assignedTo))
                if (empSnap.exists()) {
                  userData = empSnap.data()
                }
              } catch (empError) {
                console.log('Employee not found, trying users collection')
              }
              
              if (!userData) {
                try {
                  const userSnap = await getDoc(doc(db, 'users', (task as any).assignedTo))
                  if (userSnap.exists()) {
                    userData = userSnap.data()
                  }
                } catch (userError) {
                  console.log('User not found in users collection either')
                }
              }
              
              const name = userData?.name || 
                          `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() || 
                          'Unknown User'
              
              return {
                id: (task as any).assignedTo,
                name,
                avatar: userData?.avatar,
                taskTitle: (task as any).title,
                status: (task as any).status,
                progress: (task as any).progress || 0,
              }
            } catch (userError) {
              console.error('Error fetching user data for task:', task, userError)
              return {
                id: (task as any).assignedTo,
                name: 'Unknown User',
                avatar: undefined,
                taskTitle: (task as any).title,
                status: (task as any).status,
                progress: (task as any).progress || 0,
              }
            }
          })
      )
      setEmployeeTasks(employeeTasksData as any)

      // Update the tasks state for the TaskList component
      setTasks(normalizedTasks.map(task => ({
        ...task,
        dueDate: (task as any).dueDate?.toDate?.() || (task as any).dueDate,
        createdAt: (task as any).createdAt?.toDate?.() || (task as any).createdAt,
        updatedAt: (task as any).updatedAt?.toDate?.() || (task as any).updatedAt,
        completedAt: (task as any).completedAt?.toDate?.() || (task as any).completedAt || null
      })) as Task[])
      
      console.log('Task stats updated successfully')
    } catch (error) {
      console.error('Error fetching task stats:', error)
      toast.error('Failed to fetch task statistics')
    }
  }

  const handleTaskCreated = (task: Task) => {
    setTasks(prev => [...prev, task])
    if (user?.id) {
      fetchAnalytics() // Only refresh analytics if user is available
      fetchTaskStats() // Refresh task statistics
    }
  }

  const handleTaskUpdated = (updatedTask: Task) => {
    setTasks(prev => prev.map(task => task.id === updatedTask.id ? updatedTask : task))
    if (user?.id) {
      fetchAnalytics() // Only refresh analytics if user is available
      fetchTaskStats() // Refresh task statistics when tasks are updated
    }
  }

  const handleTaskDeleted = (taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId))
    if (user?.id) {
      fetchAnalytics() // Only refresh analytics if user is available
      fetchTaskStats() // Refresh task statistics when tasks are deleted
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Calendar
            {...({
              mode: "range",
              selected: {
                from: dateRange.from,
                to: dateRange.to
              },
              onSelect: (range: any) => {
                if (range?.from && range?.to) {
                  setDateRange({ from: range.from, to: range.to })
                }
              },
              className: "rounded-md border"
            } as any)}
          />
          <Button
            variant="outline"
            onClick={() => {
              const today = new Date()
              setDateRange({
                from: new Date(today.setDate(today.getDate() - 7)),
                to: new Date()
              })
            }}
          >
            Last 7 Days
          </Button>
        </div>
      </div>

      {/* Overview Cards and Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {!analytics ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No Data Available</h3>
              <p className="mt-2 text-sm text-gray-500">
                Start tracking your productivity to see analytics.
              </p>
            </div>
          ) : (
            <>
              {/* Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Productivity Score</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.overview.averageProductivityScore}%</div>
                    <Progress 
                      value={analytics.overview.averageProductivityScore} 
                      className="mt-2"
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Task Progress</CardTitle>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setActiveTab('tasks')
                          setShowTaskModal(true)
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        New Task
                      </Button>
                      <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {taskStats.totalIssued > 0 ? Math.round((taskStats.completed / taskStats.totalIssued) * 100) : 0}%
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {taskStats.completed} of {taskStats.totalIssued} tasks completed
                    </div>
                    <Button
                      variant="link"
                      className="p-0 h-auto text-xs text-blue-600 hover:text-blue-800 mt-2"
                      onClick={() => setActiveTab('tasks')}
                    >
                      View all tasks →
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Focus Time</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.overview.focusTimePercentage}%</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {analytics.overview.totalFocusSessions} focus sessions
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Meeting Efficiency</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.overview.meetingEfficiency}%</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {analytics.overview.totalMeetingHours.toFixed(1)} hours in meetings
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Daily Productivity Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Daily Productivity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics.trends.daily}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(date) => new Date(date).toLocaleDateString()}
                        />
                        <YAxis />
                        <Tooltip 
                          labelFormatter={(date) => new Date(date).toLocaleDateString()}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="productivityScore" 
                          stroke="#2563eb" 
                          name="Productivity"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="tasksCompleted" 
                          stroke="#16a34a" 
                          name="Tasks Completed"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Time Allocation Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Time Allocation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.trends.daily}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(date) => new Date(date).toLocaleDateString()}
                        />
                        <YAxis />
                        <Tooltip 
                          labelFormatter={(date) => new Date(date).toLocaleDateString()}
                        />
                        <Legend />
                        <Bar 
                          dataKey="focusTime" 
                          fill="#2563eb" 
                          name="Focus Time (min)"
                        />
                        <Bar 
                          dataKey="meetingTime" 
                          fill="#16a34a" 
                          name="Meeting Time (min)"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          {!analytics ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No Data Available</h3>
              <p className="mt-2 text-sm text-gray-500">
                Start tracking your productivity to see analytics.
              </p>
            </div>
          ) : (
            <>
              {/* Weekly Trends */}
              <Card>
                <CardHeader>
                  <CardTitle>Weekly Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics.trends.weekly}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="weekStart" 
                          tickFormatter={(date) => new Date(date).toLocaleDateString()}
                        />
                        <YAxis />
                        <Tooltip 
                          labelFormatter={(date) => new Date(date).toLocaleDateString()}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="averageProductivity" 
                          stroke="#2563eb" 
                          name="Productivity"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="tasksCompleted" 
                          stroke="#16a34a" 
                          name="Tasks Completed"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Monthly Trends */}
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.trends.monthly}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="month" 
                          tickFormatter={(date) => new Date(date).toLocaleDateString('default', { month: 'short' })}
                        />
                        <YAxis />
                        <Tooltip 
                          labelFormatter={(date) => new Date(date).toLocaleDateString('default', { month: 'long' })}
                        />
                        <Legend />
                        <Bar 
                          dataKey="productivityScore" 
                          fill="#2563eb" 
                          name="Productivity"
                        />
                        <Bar 
                          dataKey="focusTimePercentage" 
                          fill="#16a34a" 
                          name="Focus Time %"
                        />
                        <Bar 
                          dataKey="meetingEfficiency" 
                          fill="#9333ea" 
                          name="Meeting Efficiency"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="projects" className="space-y-6">
          {!analytics ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No Data Available</h3>
              <p className="mt-2 text-sm text-gray-500">
                Start tracking your productivity to see analytics.
              </p>
            </div>
          ) : (
            <>
              {/* Project Performance */}
              <Card>
                <CardHeader>
                  <CardTitle>Project Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.projectWise}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="projectName" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar 
                          dataKey="productivityScore" 
                          fill="#2563eb" 
                          name="Productivity"
                        />
                        <Bar 
                          dataKey="taskCompletion" 
                          fill="#16a34a" 
                          name="Task Completion"
                        />
                        <Bar 
                          dataKey="timeAllocation" 
                          fill="#9333ea" 
                          name="Hours"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="team" className="space-y-6">
          {!analytics ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No Data Available</h3>
              <p className="mt-2 text-sm text-gray-500">
                Start tracking your productivity to see analytics.
              </p>
            </div>
          ) : (
            <>
              {/* Team Performance */}
              <Card>
                <CardHeader>
                  <CardTitle>Team Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.teamStats}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar 
                          dataKey="productivityScore" 
                          fill="#2563eb" 
                          name="Productivity"
                        />
                        <Bar 
                          dataKey="tasksCompleted" 
                          fill="#16a34a" 
                          name="Tasks Completed"
                        />
                        <Bar 
                          dataKey="focusTime" 
                          fill="#9333ea" 
                          name="Focus Time (min)"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold">Task Management</h2>
              <p className="text-sm text-gray-500">Manage and track your tasks</p>
            </div>
            <Button onClick={() => setShowTaskModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Task
            </Button>
          </div>

          {/* Task Progress Cards */}
          <TaskProgressCards stats={taskStats} employees={employeeTasks} />

          {/* Task Overview Card */}
          <Card>
            <CardHeader>
              <CardTitle>Task Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-medium text-blue-700">Pending Tasks</h3>
                  <p className="text-2xl font-bold text-blue-900">
                    {taskStats.pending}
                  </p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <h3 className="font-medium text-green-700">Completed Tasks</h3>
                  <p className="text-2xl font-bold text-green-900">
                    {taskStats.completed}
                  </p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h3 className="font-medium text-purple-700">Completion Rate</h3>
                  <p className="text-2xl font-bold text-purple-900">
                    {taskStats.totalIssued > 0 ? Math.round((taskStats.completed / taskStats.totalIssued) * 100) : 0}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <TaskList
            tasks={tasks}
            loading={loading}
            onTaskUpdate={handleTaskUpdated}
            onTaskDelete={handleTaskDeleted}
          />
        </TabsContent>
      </Tabs>

      {/* Quick Access FAB */}
      <Button
        className="fixed bottom-6 right-6 rounded-full w-14 h-14 shadow-lg"
        onClick={() => setShowTaskModal(true)}
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Task Modal */}
      <CreateTaskModal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        onSuccess={handleTaskCreated}
      />
    </div>
  )
} 