'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "react-hot-toast"
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/auth-context'
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface Task {
  id: string
  title: string
  description: string
  assignedTo: string
  assignedBy: string
  dueDate: string
  status: 'pending' | 'accepted' | 'in_progress' | 'completed'
  createdAt: string
}

interface Employee {
  id: string
  name: string
  email: string
  role: string
}

export function ProductivityDashboard() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assignedTo: '',
    dueDate: ''
  })
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    fetchEmployees()
    fetchTasks()
  }, [])

  const fetchEmployees = async () => {
    try {
      const employeesRef = collection(db, 'users')
      const q = query(employeesRef, where('role', '==', 'employee'))
      const querySnapshot = await getDocs(q)
      const employeesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Employee[]
      setEmployees(employeesData)
    } catch (error) {
      console.error('Error fetching employees:', error)
      toast.error('Failed to fetch employees')
    }
  }

  const fetchTasks = async () => {
    try {
      const tasksRef = collection(db, 'tasks')
      const querySnapshot = await getDocs(tasksRef)
      const tasksData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Task[]
      setTasks(tasksData)
    } catch (error) {
      console.error('Error fetching tasks:', error)
      toast.error('Failed to fetch tasks')
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
      fetchTasks()
    } catch (error) {
      console.error('Error assigning task:', error)
      toast.error('Failed to assign task')
    }
  }

  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500'
      case 'accepted':
        return 'bg-blue-500'
      case 'in_progress':
        return 'bg-purple-500'
      case 'completed':
        return 'bg-green-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusText = (status: Task['status']) => {
    switch (status) {
      case 'pending':
        return 'Pending'
      case 'accepted':
        return 'Accepted'
      case 'in_progress':
        return 'In Progress'
      case 'completed':
        return 'Completed'
      default:
        return status
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
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
                <Select
                  value={newTask.assignedTo}
                  onValueChange={(value) => setNewTask({ ...newTask, assignedTo: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

      <Card>
        <CardHeader>
          <CardTitle>Employee Task Status</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => {
                const employee = employees.find(emp => emp.id === task.assignedTo)
                const assignedBy = employees.find(emp => emp.id === task.assignedBy)
                return (
                  <TableRow key={task.id}>
                    <TableCell>{employee?.name || 'Unknown'}</TableCell>
                    <TableCell>{task.title}</TableCell>
                    <TableCell>{new Date(task.dueDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(task.status)}>
                        {getStatusText(task.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{assignedBy?.name || 'Unknown'}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
} 