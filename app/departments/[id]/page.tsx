'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useNewAuth } from '@/contexts/new-auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Users, 
  MessageSquare, 
  Bell, 
  Mail, 
  User, 
  Building2, 
  Search,
  Send,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react'
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { toast } from 'react-hot-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  sendCustomNotification, 
  sendTaskAssignmentNotification,
  sendBreakReminder,
  sendCongratulationsNotification 
} from '@/lib/notifications'

interface Employee {
  id: string
  uid: string
  firstName: string
  lastName: string
  email: string
  position: string
  role: string
  status: 'active' | 'inactive' | 'on_leave'
  department: string
  managerId?: string
  avatar?: string
}

interface Department {
  id: string
  name: string
  description: string
  managerId?: string
  managerName?: string
  employeeCount: number
}

export default function DepartmentDetailPage() {
  const params = useParams()
  const { user } = useNewAuth()
  const [department, setDepartment] = useState<Department | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [isNotificationDialogOpen, setIsNotificationDialogOpen] = useState(false)
  const [notificationType, setNotificationType] = useState('custom')
  const [notificationMessage, setNotificationMessage] = useState('')
  const [notificationTitle, setNotificationTitle] = useState('')
  const [isSending, setIsSending] = useState(false)

  const departmentId = params.id as string

  const fetchDepartmentData = async () => {
    try {
      setIsLoading(true)
      
      // Fetch department details
      const departmentDoc = await getDoc(doc(db, 'departments', departmentId))
      if (!departmentDoc.exists()) {
        toast.error('Department not found')
        return
      }

      const departmentData = departmentDoc.data()
      
      // Get manager details if exists
      let managerName = ''
      if (departmentData.managerId) {
        const managerDoc = await getDoc(doc(db, 'employees', departmentData.managerId))
        if (managerDoc.exists()) {
          const managerData = managerDoc.data()
          managerName = `${managerData.firstName} ${managerData.lastName}`
        }
      }

      const departmentInfo: Department = {
        id: departmentDoc.id,
        name: departmentData.name,
        description: departmentData.description,
        managerId: departmentData.managerId,
        managerName,
        employeeCount: 0
      }

      // Fetch employees in this department
      const employeesRef = collection(db, 'employees')
      const q = query(employeesRef, where('department', '==', departmentData.name))
      const employeesSnapshot = await getDocs(q)
      
      const employeesData: Employee[] = employeesSnapshot.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          uid: data.uid || '',
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          position: data.position,
          role: data.role,
          status: data.status,
          department: data.department,
          managerId: data.managerId,
          avatar: data.avatar
        }
      })

      departmentInfo.employeeCount = employeesData.length
      setDepartment(departmentInfo)
      setEmployees(employeesData)
    } catch (error) {
      console.error('Error fetching department data:', error)
      toast.error('Failed to load department data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (departmentId) {
      fetchDepartmentData()
    }
  }, [departmentId])

  const filteredEmployees = employees.filter(employee =>
    `${employee.firstName} ${employee.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    employee.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    employee.position.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSelectEmployee = (employeeId: string) => {
    setSelectedEmployees(prev => 
      prev.includes(employeeId) 
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    )
  }

  const handleSelectAll = () => {
    if (selectedEmployees.length === filteredEmployees.length) {
      setSelectedEmployees([])
    } else {
      setSelectedEmployees(filteredEmployees.map(emp => emp.id))
    }
  }

  const handleSendNotification = async () => {
    if (selectedEmployees.length === 0) {
      toast.error('Please select at least one employee')
      return
    }

    if (!notificationMessage.trim()) {
      toast.error('Please enter a message')
      return
    }

    setIsSending(true)
    try {
      const targetEmployees = employees.filter(emp => selectedEmployees.includes(emp.id))
      
      for (const employee of targetEmployees) {
        switch (notificationType) {
          case 'custom':
            await sendCustomNotification(
              employee.uid || employee.id,
              notificationTitle || 'Department Notification',
              notificationMessage,
              'info'
            )
            break
          case 'task_assignment':
            await sendTaskAssignmentNotification(
              employee.uid || employee.id,
              {
                title: notificationTitle || 'New Task Assigned',
                description: notificationMessage,
                assignedBy: user?.name || user?.email || 'System',
                priority: 'medium'
              }
            )
            break
          case 'break_reminder':
            await sendBreakReminder(employee.uid || employee.id, 'lunch')
            break
          case 'congratulations':
            await sendCongratulationsNotification(
              employee.uid || employee.id,
              notificationMessage
            )
            break
        }
      }

      toast.success(`Notification sent to ${targetEmployees.length} employee(s)`)
      setIsNotificationDialogOpen(false)
      setNotificationMessage('')
      setNotificationTitle('')
      setSelectedEmployees([])
    } catch (error) {
      console.error('Error sending notifications:', error)
      toast.error('Failed to send notifications')
    } finally {
      setIsSending(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!department) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold text-gray-900">Department not found</h2>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Department Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{department.name}</h1>
          <p className="text-muted-foreground">{department.description}</p>
          <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
            <div className="flex items-center">
              <Users className="h-4 w-4 mr-1" />
              {department.employeeCount} employees
            </div>
            {department.managerName && (
              <div className="flex items-center">
                <Building2 className="h-4 w-4 mr-1" />
                Manager: {department.managerName}
              </div>
            )}
          </div>
        </div>
        
        <Dialog open={isNotificationDialogOpen} onOpenChange={setIsNotificationDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={selectedEmployees.length === 0}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Send Notification ({selectedEmployees.length})
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Send Notification</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Notification Type</label>
                <Select value={notificationType} onValueChange={setNotificationType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Custom Message</SelectItem>
                    <SelectItem value="task_assignment">Task Assignment</SelectItem>
                    <SelectItem value="break_reminder">Break Reminder</SelectItem>
                    <SelectItem value="congratulations">Congratulations</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {notificationType === 'custom' && (
                <div>
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    placeholder="Notification title..."
                    value={notificationTitle}
                    onChange={(e) => setNotificationTitle(e.target.value)}
                  />
                </div>
              )}
              
              <div>
                <label className="text-sm font-medium">Message</label>
                <Textarea
                  placeholder="Enter your message..."
                  value={notificationMessage}
                  onChange={(e) => setNotificationMessage(e.target.value)}
                  rows={4}
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setIsNotificationDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSendNotification}
                  disabled={isSending || !notificationMessage.trim()}
                >
                  {isSending ? 'Sending...' : 'Send'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Employee List */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Employees</CardTitle>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedEmployees.length === filteredEmployees.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredEmployees.map((employee) => (
              <div
                key={employee.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  selectedEmployees.includes(employee.id) 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-4">
                  <input
                    type="checkbox"
                    checked={selectedEmployees.includes(employee.id)}
                    onChange={() => handleSelectEmployee(employee.id)}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="h-5 w-5 text-gray-500" />
                  </div>
                  <div>
                    <h3 className="font-medium">
                      {employee.firstName} {employee.lastName}
                    </h3>
                    <p className="text-sm text-muted-foreground">{employee.email}</p>
                    <p className="text-sm text-muted-foreground">{employee.position}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Badge variant={
                    employee.status === 'active' ? 'default' :
                    employee.status === 'on_leave' ? 'secondary' : 'destructive'
                  }>
                    {employee.status}
                  </Badge>
                  <Badge variant="outline">
                    {employee.role}
                  </Badge>
                </div>
              </div>
            ))}
            
            {filteredEmployees.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No employees found
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 