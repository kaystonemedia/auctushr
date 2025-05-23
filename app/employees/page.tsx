'use client'

import { useState, useEffect } from 'react'
import { Plus, Search } from "lucide-react"
import { EmployeeTable } from "@/components/employee-table"
import { EmployeeForm } from "@/components/employee-form"
import { Employee, EmployeeFormData } from "@/types/employee"
import { db } from "@/lib/firebase"
import { collection, getDocs, updateDoc, deleteDoc, doc, query, orderBy, Timestamp } from "firebase/firestore"
import { toast } from "react-hot-toast"
import { createEmployee, deleteEmployee, updateEmployee } from "@/lib/firebase"
import { useAuth } from "@/contexts/auth-context"

export default function EmployeesPage() {
  const { user, firebaseUser, loading: authLoading } = useAuth()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)

  useEffect(() => {
    if (!authLoading && firebaseUser) {
      fetchEmployees()
    }
  }, [authLoading, firebaseUser])

  const fetchEmployees = async () => {
    try {
      setLoading(true)
      
      if (!firebaseUser) {
        console.log('No Firebase user found, skipping fetch')
        throw new Error('User not authenticated')
      }

      // Get the current user's ID token from firebaseUser
      const token = await firebaseUser.getIdToken()
      console.log('Got user token, fetching employees...')
      
      // Fetch employees from your backend with auth token
      const response = await fetch('/api/employees', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('API response not ok:', response.status, error)
        throw new Error(error.error || 'Failed to fetch employees')
      }

      const data = await response.json()
      console.log('Received employee data:', data)

      if (!data.employees || !Array.isArray(data.employees)) {
        console.error('Invalid response format:', data)
        throw new Error('Invalid response format')
      }

      if (data.employees.length === 0) {
        console.log('No employees found in the response')
      } else {
        console.log(`Found ${data.employees.length} employees`)
      }

      setEmployees(data.employees)
    } catch (error) {
      console.error('Error fetching employees:', error)
      if (error instanceof Error) {
        toast.error(error.message)
      } else {
        toast.error('Failed to load employees')
      }
      setEmployees([]) // Set empty array on error
    } finally {
      setLoading(false)
    }
  }

  const handleAddEmployee = async (data: EmployeeFormData) => {
    try {
      console.log('Adding employee with data:', data)
      
      // Create employee using the createEmployee function
      const user = await createEmployee(data)
      console.log('Created user:', user)

      if (!user) {
        throw new Error('Failed to create employee')
      }

      // Update local state
      const newEmployee = {
        id: user.uid,
        uid: user.uid,
        ...data,
        hireDate: data.hireDate instanceof Date ? data.hireDate : new Date(data.hireDate),
        salary: Number(data.salary),
        status: data.status || 'active',
        hasPassword: false,
        createdAt: new Date(),
        updatedAt: new Date()
      } as Employee
      
      setEmployees(prev => [...prev, newEmployee])
      toast.success("Employee added successfully")
    } catch (error) {
      console.error("Error adding employee:", error)
      if (error instanceof Error) {
        toast.error(`Failed to add employee: ${error.message}`)
      } else {
        toast.error("Failed to add employee")
      }
      throw error
    }
  }

  const handleEditEmployee = async (data: EmployeeFormData) => {
    if (!selectedEmployee) return

    try {
      await updateEmployee(selectedEmployee.id, data)
      
      // Update local state
      setEmployees(prev => prev.map(emp => 
        emp.id === selectedEmployee.id 
          ? { ...emp, ...data, updatedAt: new Date() }
          : emp
      ))
      
      toast.success("Employee updated successfully")
    } catch (error) {
      console.error("Error updating employee:", error)
      if (error instanceof Error) {
        toast.error(`Failed to update employee: ${error.message}`)
      } else {
        toast.error("Failed to update employee")
      }
      throw error
    }
  }

  const handleDeleteEmployee = async (employeeId: string) => {
    try {
      await deleteEmployee(employeeId)
      setEmployees(prev => prev.filter(emp => emp.id !== employeeId))
      toast.success("Employee deleted successfully")
    } catch (error) {
      console.error("Error deleting employee:", error)
      if (error instanceof Error) {
        toast.error(`Failed to delete employee: ${error.message}`)
      } else {
        toast.error("Failed to delete employee")
      }
    }
  }

  const handleFormSubmit = async (data: EmployeeFormData) => {
    try {
      console.log('Form submitted with data:', data)
      
      if (selectedEmployee) {
        await handleEditEmployee(data)
      } else {
        await handleAddEmployee(data)
      }
      
      setIsFormOpen(false)
      setSelectedEmployee(null)
      
      // Refresh the employees list
      await fetchEmployees()
    } catch (error) {
      console.error("Error submitting form:", error)
      if (error instanceof Error) {
        toast.error(error.message)
      } else {
        toast.error("Failed to save employee")
      }
    }
  }

  const handleEdit = (employee: Employee) => {
    setSelectedEmployee(employee)
    setIsFormOpen(true)
  }

  const handleDelete = (employeeId: string) => {
    if (window.confirm("Are you sure you want to delete this employee?")) {
      handleDeleteEmployee(employeeId)
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your organization's employees and their roles
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedEmployee(null)
            setIsFormOpen(true)
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Employee
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <EmployeeTable
          employees={employees}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>

      <EmployeeForm
        isOpen={isFormOpen}
        initialData={selectedEmployee ? {
          firstName: selectedEmployee.firstName,
          lastName: selectedEmployee.lastName,
          email: selectedEmployee.email,
          phone: selectedEmployee.phone,
          department: selectedEmployee.department,
          position: selectedEmployee.position,
          role: selectedEmployee.role,
          managerId: selectedEmployee.managerId,
          hasPassword: selectedEmployee.hasPassword,
          hireDate: selectedEmployee.hireDate,
          salary: selectedEmployee.salary,
          status: selectedEmployee.status,
          address: selectedEmployee.address,
          emergencyContact: selectedEmployee.emergencyContact,
          documents: selectedEmployee.documents,
          uid: selectedEmployee.uid
        } : undefined}
        onSubmit={handleFormSubmit}
        onClose={() => {
          setIsFormOpen(false)
          setSelectedEmployee(null)
        }}
      />
    </div>
  )
} 