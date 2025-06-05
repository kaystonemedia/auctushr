'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Check, ChevronsUpDown, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "react-hot-toast"
import { collection, query, where, getDocs, addDoc, updateDoc, doc, orderBy, limit } from 'firebase/firestore'
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

export function ProductivityDashboard() {
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today')
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [stats, setStats] = useState<ProductivityStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assignedTo: '',
    dueDate: ''
  })
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const { user } = useNewAuth()

  useEffect(() => {
    fetchEmployees()
    fetchProductivityStats()
  }, [timeRange, selectedEmployee])

  const fetchEmployees = async () => {
    try {
      const employeesRef = collection(db, 'users')
      const q = query(
        employeesRef,
        where('role', 'in', ['employee', 'manager']),
        orderBy('name')
      )
      const querySnapshot = await getDocs(q)
      const employeesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Employee[]
      setEmployees(employeesData)
    } catch (error) {
      console.error('Error fetching employees:', error)
    }
  }

  const fetchProductivityStats = async () => {
    try {
      setLoading(true)
      const statsRef = collection(db, 'productivity_stats')
      let q = query(statsRef, orderBy('timestamp', 'desc'), limit(1))

      if (selectedEmployee !== 'all') {
        q = query(q, where('employeeId', '==', selectedEmployee))
      }

      const querySnapshot = await getDocs(q)
      if (!querySnapshot.empty) {
        const latestStats = querySnapshot.docs[0].data() as ProductivityStats
        setStats(latestStats)
      }
    } catch (error) {
      console.error('Error fetching productivity stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAssignTask = async () => {
    if (!newTask.title || !newTask.assignedTo || !newTask.dueDate) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      const taskData = {
        ...newTask,
        assignedBy: user?.uid,
        status: 'pending',
        createdAt: new Date().toISOString()
      }

      await addDoc(collection(db, 'tasks'), taskData)
      toast.success('Task assigned successfully')
      setIsDialogOpen(false)
      setNewTask({
        title: '',
        description: '',
        assignedTo: '',
        dueDate: ''
      })
      fetchProductivityStats()
    } catch (error) {
      console.error('Error assigning task:', error)
      toast.error('Failed to assign task')
    }
  }

  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60))
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-500'
      case 'medium':
        return 'bg-yellow-500'
      case 'low':
        return 'bg-blue-500'
      default:
        return 'bg-gray-500'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Productivity Dashboard</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>Assign New Task</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign New Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="Enter task title"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Enter task description"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Assign To</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {newTask.assignedTo ? (
                        employees.find(emp => emp.id === newTask.assignedTo)?.name || 'Select employee...'
                      ) : (
                        'Select employee...'
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[250px] p-0">
                    <Command>
                      <CommandInput placeholder="Search employee..." />
                      <CommandEmpty>No employee found.</CommandEmpty>
                      <CommandGroup>
                        {employees.map((employee) => (
                          <CommandItem
                            key={employee.id}
                            value={employee.name}
                            onSelect={() => {
                              setNewTask({ ...newTask, assignedTo: employee.id })
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                newTask.assignedTo === employee.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {employee.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-sm font-medium">Due Date</label>
                <Input
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                />
              </div>
              <Button onClick={handleAssignTask} className="w-full">
                Assign Task
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex justify-between items-center">
        <div className="flex gap-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-[250px] justify-between"
              >
                {selectedEmployee === 'all' ? (
                  <>
                    <Users className="mr-2 h-4 w-4" />
                    All Employees
                  </>
                ) : (
                  <>
                    <Users className="mr-2 h-4 w-4" />
                    {employees.find(emp => emp.id === selectedEmployee)?.name || 'Select employee...'}
                  </>
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-0">
              <Command>
                <CommandInput placeholder="Search employee..." />
                <CommandEmpty>No employee found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="all"
                    onSelect={() => {
                      setSelectedEmployee('all')
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedEmployee === 'all' ? "opacity-100" : "opacity-0"
                      )}
                    />
                    All Employees
                  </CommandItem>
                  {employees.map((employee) => (
                    <CommandItem
                      key={employee.id}
                      value={employee.name}
                      onSelect={() => {
                        setSelectedEmployee(employee.id)
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedEmployee === employee.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {employee.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>

          <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as any)} className="w-[400px]">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="week">This Week</TabsTrigger>
              <TabsTrigger value="month">This Month</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Focus Time</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats ? formatDuration(stats.focusTime) : '0h 0m'}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats ? Math.round((stats.focusTime / (stats.focusTime + stats.idleTime)) * 100) : 0}% of total time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Break Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats ? formatDuration(stats.breakTime) : '0h 0m'}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats ? Math.round((stats.breakTime / (stats.focusTime + stats.idleTime)) * 100) : 0}% of total time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Meeting Time</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats ? formatDuration(stats.meetingTime) : '0h 0m'}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats ? stats.meetings.length : 0} meetings today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Task Progress</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats ? Math.round(stats.taskProgress) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {stats ? `${stats.tasks.filter(t => t.completed).length} of ${stats.tasks.length} tasks completed` : 'No tasks'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Activity by Hour</CardTitle>
          </CardHeader>
          <CardContent>
            {stats && (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.activityByHour}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="active" name="Active" fill="#22c55e" />
                  <Bar dataKey="idle" name="Idle" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Websites</CardTitle>
          </CardHeader>
          <CardContent>
            {stats && (
              <div className="space-y-4">
                {stats.topWebsites.slice(0, 5).map((site, index) => (
                  <div key={site.domain} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{site.domain}</span>
                      <Badge variant="secondary">{site.visits} visits</Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatDuration(site.time)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Activity Flags
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats && stats.flags.length > 0 ? (
              <div className="space-y-4">
                {stats.flags.map((flag, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted">
                    <Badge className={getSeverityColor(flag.severity)}>
                      {flag.type}
                    </Badge>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{flag.type}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(flag.timestamp), 'MMM d, h:mm a')}
                      </p>
                      {flag.details && (
                        <p className="text-xs mt-1">{JSON.stringify(flag.details)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No flags recorded</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Location History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats && stats.locationHistory.length > 0 ? (
              <div className="space-y-4">
                {stats.locationHistory.slice(-5).map((location, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted">
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(location.timestamp), 'MMM d, h:mm a')}
                      </p>
                      <p className="text-xs mt-1">
                        Accuracy: {Math.round(location.accuracy)}m
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No location data available</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 