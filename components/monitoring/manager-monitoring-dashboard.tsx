'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { 
  Monitor, 
  Camera, 
  Activity, 
  Users,
  Calendar as CalendarIcon,
  Search,
  Filter,
  Download,
  Eye,
  Clock,
  AlertTriangle
} from 'lucide-react'
import { useNewAuth } from '@/contexts/new-auth-context'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

/** Radix Select does not allow SelectItem value="" */
const ALL_DEPARTMENTS_VALUE = '__all_departments__'

interface Employee {
  id: string
  name: string
  email: string
  department?: string
  role: string
  isActive: boolean
  lastActivity?: string
}

interface MonitoringData {
  employee: Employee
  date: string
  screenshots: Array<{
    id: string
    timestamp: string
    imageUrl: string
    activeWindow?: {
      title: string
      owner: string
    }
    workStatus: string
  }>
  activities: Array<{
    id: string
    timestamp: string
    activeWindow?: {
      title: string
      owner: string
    }
    idleTime: number
    workStatus: string
  }>
  stats: {
    totalScreenshots: number
    totalActivities: number
    workingHours: number
    idleHours: number
    productiveTime: number
  }
}

export function ManagerMonitoringDashboard() {
  const { user, firebaseUser } = useNewAuth()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [monitoringData, setMonitoringData] = useState<MonitoringData | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDepartment, setFilterDepartment] = useState<string>(ALL_DEPARTMENTS_VALUE)
  const [showCalendar, setShowCalendar] = useState(false)

  useEffect(() => {
    if (
      user &&
      firebaseUser &&
      (user.role === 'admin' || user.role === 'manager')
    ) {
      fetchEmployees()
    }
  }, [user, firebaseUser])

  useEffect(() => {
    if (selectedEmployee && selectedDate && firebaseUser) {
      fetchMonitoringData()
    }
  }, [selectedEmployee, selectedDate, firebaseUser])

  const fetchEmployees = async () => {
    if (!firebaseUser) return
    try {
      const token = await firebaseUser.getIdToken()
      const response = await fetch('/api/employees', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        const raw = data.employees || []
        setEmployees(
          raw.map((e: Record<string, unknown>) => {
            const first = typeof e.firstName === 'string' ? e.firstName : ''
            const last = typeof e.lastName === 'string' ? e.lastName : ''
            const fromParts = `${first} ${last}`.trim()
            const name =
              (typeof e.name === 'string' && e.name.trim()) ||
              fromParts ||
              'Unknown'
            return {
              ...e,
              id: String(e.id ?? ''),
              name,
              email: typeof e.email === 'string' ? e.email : '',
              department: typeof e.department === 'string' ? e.department : undefined,
              role: typeof e.role === 'string' ? e.role : 'employee',
              isActive: Boolean(e.isActive ?? e.status === 'active'),
            } as Employee
          })
        )
      } else {
        toast.error('Failed to fetch employees')
      }
    } catch (error) {
      console.error('Error fetching employees:', error)
      toast.error('Failed to fetch employees')
    }
  }

  const fetchMonitoringData = async () => {
    if (!selectedEmployee || !firebaseUser) return

    try {
      setLoading(true)
      const token = await firebaseUser.getIdToken()
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      
      const response = await fetch(`/api/monitoring/employee/${selectedEmployee}?date=${dateStr}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setMonitoringData(data.data)
      } else {
        toast.error('Failed to fetch monitoring data')
        setMonitoringData(null)
      }
    } catch (error) {
      console.error('Error fetching monitoring data:', error)
      toast.error('Failed to fetch monitoring data')
      setMonitoringData(null)
    } finally {
      setLoading(false)
    }
  }

  const handleEmployeeSelect = (employeeId: string) => {
    setSelectedEmployee(employeeId)
    setMonitoringData(null)
  }

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date)
      setShowCalendar(false)
    }
  }

  const handleExportData = async () => {
    if (!monitoringData) return

    try {
      const dataToExport = {
        employee: monitoringData.employee,
        date: monitoringData.date,
        stats: monitoringData.stats,
        screenshots: monitoringData.screenshots.map(s => ({
          ...s,
          imageUrl: undefined // Remove image URLs for privacy
        })),
        activities: monitoringData.activities,
        exportedBy: user?.name,
        exportedAt: new Date().toISOString()
      }

      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `monitoring-report-${monitoringData.employee.name}-${monitoringData.date}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success('Report exported successfully')
    } catch (error) {
      console.error('Error exporting data:', error)
      toast.error('Failed to export data')
    }
  }

  const filteredEmployees = employees.filter(emp => {
    const name = (emp.name ?? '').toString().toLowerCase()
    const email = (emp.email ?? '').toString().toLowerCase()
    const q = searchTerm.toLowerCase()
    const matchesSearch = name.includes(q) || email.includes(q)
    const matchesDepartment =
      filterDepartment === ALL_DEPARTMENTS_VALUE ||
      !filterDepartment ||
      emp.department === filterDepartment
    return matchesSearch && matchesDepartment
  })

  const departments = [...new Set(employees.map(emp => emp.department).filter(Boolean))]

  if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
          <p className="text-gray-600">You don't have permission to view employee monitoring data.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Employee Monitoring Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Employee Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Search Employees</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            {/* Department Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Department</label>
              <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_DEPARTMENTS_VALUE}>All departments</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept} value={dept as string}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Employee Select */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Employee</label>
              <Select
                value={selectedEmployee || undefined}
                onValueChange={handleEmployeeSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {filteredEmployees.filter((emp) => emp.id).map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          emp.isActive ? "bg-green-500" : "bg-gray-400"
                        )} />
                        {emp.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Picker */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <Popover open={showCalendar} onOpenChange={setShowCalendar}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedDate, 'PP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monitoring Data */}
      {loading ? (
        <Card>
          <CardContent className="p-6 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p>Loading monitoring data...</p>
          </CardContent>
        </Card>
      ) : monitoringData ? (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Camera className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-blue-700">
                  {monitoringData.stats.totalScreenshots}
                </div>
                <div className="text-xs text-blue-600">Screenshots</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Activity className="h-6 w-6 text-green-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-700">
                  {monitoringData.stats.totalActivities}
                </div>
                <div className="text-xs text-green-600">Activities</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Clock className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-purple-700">
                  {monitoringData.stats.workingHours.toFixed(1)}h
                </div>
                <div className="text-xs text-purple-600">Working</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Monitor className="h-6 w-6 text-orange-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-orange-700">
                  {monitoringData.stats.productiveTime.toFixed(1)}%
                </div>
                <div className="text-xs text-orange-600">Productive</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex justify-center mb-2">
                  <Button onClick={handleExportData} size="sm">
                    <Download className="h-4 w-4 mr-1" />
                    Export
                  </Button>
                </div>
                <div className="text-xs text-gray-600">Generate Report</div>
              </CardContent>
            </Card>
          </div>

          {/* Screenshots */}
          {monitoringData.screenshots.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="h-5 w-5" />
                    Screenshots ({monitoringData.screenshots.length})
                  </div>
                  <Badge variant="outline">
                    {monitoringData.employee.name} - {format(selectedDate, 'PP')}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {monitoringData.screenshots.map((screenshot) => (
                    <div key={screenshot.id} className="relative group">
                      <img
                        src={screenshot.imageUrl}
                        alt="Employee screenshot"
                        className="w-full h-24 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => window.open(screenshot.imageUrl, '_blank')}
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all rounded-lg flex items-center justify-center">
                        <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="absolute bottom-1 left-1 right-1">
                        <div className="text-xs text-white bg-black bg-opacity-75 px-1 py-0.5 rounded text-center">
                          {format(new Date(screenshot.timestamp), 'HH:mm:ss')}
                        </div>
                      </div>
                      {screenshot.activeWindow && (
                        <div className="absolute top-1 left-1 right-1">
                          <div className="text-xs text-white bg-black bg-opacity-75 px-1 py-0.5 rounded truncate">
                            {screenshot.activeWindow.title}
                          </div>
                        </div>
                      )}
                      <Badge 
                        className="absolute top-1 right-1 text-xs"
                        variant={screenshot.workStatus === 'working' ? 'default' : 'secondary'}
                      >
                        {screenshot.workStatus}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Activity Timeline */}
          {monitoringData.activities.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Activity Timeline ({monitoringData.activities.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {monitoringData.activities.slice(0, 50).map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-medium">
                          {format(new Date(activity.timestamp), 'HH:mm:ss')}
                        </div>
                        <div className="text-sm text-gray-600">
                          {activity.activeWindow?.title || 'No active window'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={activity.workStatus === 'working' ? 'default' : 'secondary'}>
                          {activity.workStatus}
                        </Badge>
                        {activity.idleTime > 300000 && (
                          <Badge variant="destructive">
                            Idle {Math.round(activity.idleTime / 60000)}m
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : selectedEmployee ? (
        <Card>
          <CardContent className="p-6 text-center">
            <Monitor className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
            <p className="text-gray-600">
              No monitoring data found for {employees.find(e => e.id === selectedEmployee)?.name} on {format(selectedDate, 'PP')}.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Select Employee</h3>
            <p className="text-gray-600">
              Choose an employee and date to view their monitoring data.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}