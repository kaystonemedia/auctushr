'use client'

import { useState, useEffect } from 'react'
import { useNewAuth } from '@/contexts/new-auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Search, Building2, Users, Pencil, Trash2 } from 'lucide-react'
import { collection, getDocs, doc, deleteDoc, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { toast } from 'react-hot-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DepartmentForm } from '@/components/departments/department-form'

interface Department {
  id: string
  name: string
  description: string
  managerId?: string
  managerName?: string
  employeeCount: number
  createdAt: Date
  updatedAt: Date
}

export default function DepartmentsPage() {
  const { user } = useNewAuth()
  const [departments, setDepartments] = useState<Department[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)

  const fetchDepartments = async () => {
    try {
      setIsLoading(true)
      const departmentsRef = collection(db, 'departments')
      const departmentsSnapshot = await getDocs(departmentsRef)
      
      const departmentsData = await Promise.all(
        departmentsSnapshot.docs.map(async (doc) => {
          const data = doc.data()
          
          // Get employee count for this department
          const employeesRef = collection(db, 'employees')
          const q = query(employeesRef, where('departmentId', '==', doc.id))
          const employeesSnapshot = await getDocs(q)
          
          // Get manager details if exists
          let managerName = ''
          if (data.managerId) {
            const managerDoc = await getDocs(query(collection(db, 'employees'), where('id', '==', data.managerId)))
            if (!managerDoc.empty) {
              const managerData = managerDoc.docs[0].data()
              managerName = `${managerData.firstName} ${managerData.lastName}`
            }
          }

          return {
            id: doc.id,
            name: data.name,
            description: data.description,
            managerId: data.managerId,
            managerName,
            employeeCount: employeesSnapshot.size,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date()
          }
        })
      )

      setDepartments(departmentsData)
    } catch (error) {
      console.error('Error fetching departments:', error)
      toast.error('Failed to load departments')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDepartments()
  }, [])

  const handleDelete = async (departmentId: string) => {
    if (!confirm('Are you sure you want to delete this department?')) return

    try {
      // Check if department has employees
      const employeesRef = collection(db, 'employees')
      const q = query(employeesRef, where('departmentId', '==', departmentId))
      const employeesSnapshot = await getDocs(q)
      
      if (employeesSnapshot.size > 0) {
        toast.error('Cannot delete department with employees. Please reassign employees first.')
        return
      }

      await deleteDoc(doc(db, 'departments', departmentId))
      toast.success('Department deleted successfully')
      fetchDepartments()
    } catch (error) {
      console.error('Error deleting department:', error)
      toast.error('Failed to delete department')
    }
  }

  const filteredDepartments = departments.filter(dept =>
    dept.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    dept.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Departments</h1>
          <p className="text-muted-foreground">
            Manage your organization's departments and their employees
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Department
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Department</DialogTitle>
            </DialogHeader>
            <DepartmentForm
              onSuccess={() => {
                setIsAddDialogOpen(false)
                fetchDepartments()
              }}
              onCancel={() => setIsAddDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search departments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredDepartments.map((department) => (
          <div
            key={department.id}
            className="bg-white rounded-lg border p-6 space-y-4 hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h3 className="font-semibold text-lg">{department.name}</h3>
                <p className="text-sm text-muted-foreground">{department.description}</p>
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditingDepartment(department)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(department.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
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
        ))}
      </div>

      {editingDepartment && (
        <Dialog open={!!editingDepartment} onOpenChange={() => setEditingDepartment(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Department</DialogTitle>
            </DialogHeader>
            <DepartmentForm
              department={editingDepartment}
              onSuccess={() => {
                setEditingDepartment(null)
                fetchDepartments()
              }}
              onCancel={() => setEditingDepartment(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
} 