'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Filter } from "lucide-react"
import { EmployeeTable } from "@/components/employee-table"
import { EmployeeForm } from "@/components/employee-form"
import { Employee, EmployeeFormData } from "@/types/employee"
import { db } from "@/lib/firebase"
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from "firebase/firestore"
import { toast } from "react-hot-toast"
import { auth } from "@/lib/firebase"
import { createEmployee } from "@/lib/firebase"

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEmployees()
  }, [])

  const fetchEmployees = async () => {
    try {
      const q = query(collection(db, "employees"), orderBy("firstName"))
      const querySnapshot = await getDocs(q)
      const employeeList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Employee[]
      setEmployees(employeeList)
    } catch (error) {
      console.error("Error fetching employees:", error)
      toast.error("Failed to fetch employees")
    } finally {
      setLoading(false)
    }
  }

  const handleAddEmployee = async (data: EmployeeFormData) => {
    try {
      console.log('Adding employee with data:', data)
      
      // Create employee using the createEmployee function
      const user = await createEmployee({
        ...data,
        role: data.role || 'employee'
      })

      // Update local state
      const newEmployee = {
        id: user.uid,
        uid: user.uid,
        ...data,
        hasPassword: false,
        createdAt: new Date(),
        updatedAt: new Date()
      } as Employee
      
      setEmployees(prev => [...prev, newEmployee])
      
      // Show success message
      toast.success("Employee added successfully")
      
      // Log success
      console.log('Employee added successfully:', newEmployee)
    } catch (error) {
      console.error("Error adding employee:", error)
      // Show more specific error message
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
      const employeeRef = doc(db, "employees", selectedEmployee.id)
      await updateDoc(employeeRef, {
        ...data,
        updatedAt: new Date()
      })
      setEmployees(prev => prev.map(emp => 
        emp.id === selectedEmployee.id 
          ? { ...emp, ...data }
          : emp
      ))
      toast.success("Employee updated successfully")
    } catch (error) {
      console.error("Error updating employee:", error)
      toast.error("Failed to update employee")
    }
  }

  const handleDeleteEmployee = async (employeeId: string) => {
    try {
      await deleteDoc(doc(db, "employees", employeeId))
      setEmployees(prev => prev.filter(emp => emp.id !== employeeId))
      toast.success("Employee deleted successfully")
    } catch (error) {
      console.error("Error deleting employee:", error)
      toast.error("Failed to delete employee")
    }
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
    } catch (error) {
      console.error("Error submitting form:", error)
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

  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = 
      employee.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employee.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employee.email.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesDepartment = 
      departmentFilter === "all" || 
      employee.department === departmentFilter

    return matchesSearch && matchesDepartment
  })

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
        <h1 className="text-2xl font-semibold text-gray-900">Employees</h1>
        <button
          onClick={() => setIsFormOpen(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-black hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Employee
        </button>
      </div>

      <div className="flex space-x-4">
        <div className="flex-1">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search employees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
        </div>
        <div className="w-48">
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
          >
            <option value="all">All Departments</option>
            <option value="Engineering">Engineering</option>
            <option value="Marketing">Marketing</option>
            <option value="Sales">Sales</option>
            <option value="HR">HR</option>
          </select>
        </div>
      </div>

      <EmployeeTable
        employees={filteredEmployees}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {isFormOpen && (
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
      )}
    </div>
  )
} 