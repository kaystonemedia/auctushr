'use client'

import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { EmployeeTable } from '@/components/employee-table'
import { EmployeeForm } from '@/components/employee-form'
import { Employee, EmployeeFormData } from '@/types/employee'
import { toast } from 'react-hot-toast'
import { resendOnboardingInvite } from '@/lib/email-service'
import { useNewAuth } from '@/contexts/new-auth-context'

function normalizeEmployeeData(emp: Employee | null): EmployeeFormData | undefined {
  if (!emp) return undefined
  const hireDate =
    emp.hireDate instanceof Date ? emp.hireDate : new Date(emp.hireDate || Date.now())
  const address = emp.address || { street: '', city: '', state: '', country: '', postalCode: '' }
  const emergencyContact = emp.emergencyContact || { name: '', relationship: '', phone: '' }
  return {
    firstName: emp.firstName || '',
    lastName: emp.lastName || '',
    email: emp.email || '',
    phone: emp.phone || '',
    department: emp.department || '',
    position: emp.position || '',
    role: emp.role || 'employee',
    managerId: emp.managerId || null,
    hasPassword: emp.hasPassword || false,
    hireDate,
    salary: typeof emp.salary === 'number' ? emp.salary : 0,
    status: emp.status || 'active',
    mobileNumber: emp.mobileNumber || '',
    bankAccount: emp.bankAccount || {
      accountNumber: '',
      bankCode: '',
      accountName: '',
    },
    address,
    emergencyContact,
    documents: emp.documents || [],
    uid: emp.uid || null,
    collection: emp.collection,
  }
}

export default function EmployeesPage() {
  const { user, isLoading: authLoading } = useNewAuth()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)

  const fetchEmployees = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/employees', { credentials: 'include' })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch employees')
      }
      const data = await response.json()
      setEmployees(
        (data.employees || []).map((emp: Employee) => ({
          ...emp,
          hireDate: emp.hireDate ? new Date(emp.hireDate) : new Date(),
          createdAt: emp.createdAt ? new Date(emp.createdAt) : new Date(),
          updatedAt: emp.updatedAt ? new Date(emp.updatedAt) : new Date(),
        }))
      )
    } catch (error) {
      console.error('Error fetching employees:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to load employees')
      setEmployees([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading && user) {
      fetchEmployees()
    }
  }, [authLoading, user])

  const handleAddEmployee = async (data: EmployeeFormData) => {
    const employeeData = { ...data }
    if (user?.role === 'manager' && user?.id && !employeeData.managerId) {
      employeeData.managerId = user.id
    }

    const response = await fetch('/api/employees', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(employeeData),
    })

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || 'Failed to create employee')
    }

    const { employee, invite } = await response.json()

    if (invite?.sent) {
      toast.success('Employee added and onboarding email sent!')
    } else {
      toast(`Employee added, but the onboarding email was not sent: ${invite?.error || 'unknown error'}`, {
        icon: '⚠️',
        duration: 8000,
      })
    }

    setEmployees((prev) => [...prev, { ...employee, hireDate: new Date(employee.hireDate) }])
  }

  const handleEditEmployee = async (data: EmployeeFormData) => {
    if (!selectedEmployee) return

    const response = await fetch('/api/employees', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, id: selectedEmployee.id }),
    })

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || 'Failed to update employee')
    }

    const { employee } = await response.json()
    setEmployees((prev) =>
      prev.map((emp) =>
        emp.id === selectedEmployee.id
          ? { ...emp, ...employee, updatedAt: new Date() }
          : emp
      )
    )
    toast.success('Employee updated successfully')
  }

  const handleDeleteEmployee = async (employeeId: string) => {
    const response = await fetch(`/api/employees?id=${employeeId}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || 'Failed to delete employee')
    }
    setEmployees((prev) => prev.filter((emp) => emp.id !== employeeId))
    toast.success('Employee deleted successfully')
  }

  const handleFormSubmit = async (data: EmployeeFormData) => {
    try {
      if (selectedEmployee) {
        await handleEditEmployee(data)
      } else {
        await handleAddEmployee(data)
      }
      setIsFormOpen(false)
      setSelectedEmployee(null)
      await fetchEmployees()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save employee')
      throw error
    }
  }

  const handleResendInvite = async (employee: Employee) => {
    try {
      await resendOnboardingInvite(employee.id)
      toast.success(`A new invite was emailed to ${employee.email}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to resend invite')
    }
  }

  const handleEdit = (employee: Employee) => {
    setSelectedEmployee(employee)
    setIsFormOpen(true)
  }

  const handleDelete = (employeeId: string) => {
    if (window.confirm('Are you sure you want to delete this employee?')) {
      handleDeleteEmployee(employeeId).catch((error) => {
        toast.error(error instanceof Error ? error.message : 'Failed to delete employee')
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {user?.role === 'manager' ? 'My Team' : 'Employees'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {user?.role === 'manager'
              ? 'Manage your team members and add new employees'
              : "Manage your organization's employees and their roles"}
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedEmployee(null)
            setIsFormOpen(true)
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gray-900 hover:bg-gray-800"
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
          onResendInvite={handleResendInvite}
          hideManagerColumn={user?.role === 'manager'}
        />
      </div>

      <EmployeeForm
        isOpen={isFormOpen}
        initialData={normalizeEmployeeData(selectedEmployee)}
        onSubmit={handleFormSubmit}
        onClose={() => {
          setIsFormOpen(false)
          setSelectedEmployee(null)
        }}
      />
    </div>
  )
}
