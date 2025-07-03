"use client"

import { useState, useEffect } from "react"
import { useNewAuth } from '@/contexts/new-auth-context'
import { db } from '@/lib/firebase'
import { collection, query, getDocs, orderBy } from 'firebase/firestore'
import { Filter, ChevronLeft, ChevronRight, UserPlus, Loader2 } from "lucide-react"
import { Sidebar } from "./sidebar"
import { Header } from "./header"
import { EmployeeRow } from "./employee-row"
import { AddEmployeeModal } from "./add-employee-modal"
import { Employee } from '@/types/employee'

interface Manager {
  id: string
  firstName: string
  lastName: string
  position: string
  department: string
  avatar?: string
}

export default function PeopleWithAddPage() {
  const { user } = useNewAuth()
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [managers, setManagers] = useState<Manager[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')

  const ITEMS_PER_PAGE = 10

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    // Filter employees based on search and filters
    let filtered = employees

    if (searchTerm) {
      filtered = filtered.filter(emp => 
        `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.position.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (departmentFilter) {
      filtered = filtered.filter(emp => emp.department === departmentFilter)
    }

    setTotalPages(Math.ceil(filtered.length / ITEMS_PER_PAGE))
    setCurrentPage(1)
  }, [employees, searchTerm, departmentFilter])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Get employees from both users and employees collections
      const [usersSnapshot, employeesSnapshot, managersSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'users'), orderBy('firstName'))),
        getDocs(query(collection(db, 'employees'), orderBy('firstName'))),
        getDocs(query(collection(db, 'managers'), orderBy('firstName')))
      ])

      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Employee[]

      const employeesData = employeesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Employee[]

      const managersData = managersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Manager[]

      // Debug logging
      console.log('Fetched managers:', managersData)
      console.log('Number of managers:', managersData.length)

      // Combine and deduplicate employees
      const allEmployees = [...usersData, ...employeesData]
      const uniqueEmployees = allEmployees.filter((emp, index, self) => 
        index === self.findIndex(e => e.id === emp.id)
      )

      setEmployees(uniqueEmployees)
      setManagers(managersData)
    } catch (error) {
      console.error('Error loading data:', error)
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const getCurrentPageEmployees = () => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    
    let filtered = employees

    if (searchTerm) {
      filtered = filtered.filter(emp => 
        `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.position.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (departmentFilter) {
      filtered = filtered.filter(emp => emp.department === departmentFilter)
    }

    return filtered.slice(startIndex, endIndex)
  }

  const getDepartments = () => {
    return Array.from(new Set(employees.map(emp => emp.department))).sort()
  }

  const getEmployeeLocation = (employee: Employee) => {
    if (employee.address) {
      return `${employee.address.city}, ${employee.address.country}`
    }
    return 'Location not set'
  }

  const getEmployeeAvatar = (employee: Employee) => {
    return employee.photoURL || `/placeholder.svg?height=48&width=48`
  }

  const handleAddEmployee = async (employeeData: any) => {
    console.log("New employee data:", employeeData)
    // Here you would typically send this data to your API
    // and then update the employees list with the new employee
    await loadData() // Reload data after adding
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar activePath="/people" />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-4">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Loading employees...</span>
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar activePath="/people" />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-4">
            <div className="max-w-7xl mx-auto">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="text-red-800 font-medium">Error</h3>
                <p className="text-red-600">{error}</p>
                <button 
                  onClick={loadData}
                  className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Try Again
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activePath="/people" />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto p-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-700">People</h1>
                <p className="text-gray-500">{employees.length} employees</p>
              </div>

              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Departments</option>
                  {getDepartments().map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>

                <button className="flex items-center px-3 py-2 bg-gray-100 rounded-md hover:bg-gray-200">
                  <Filter size={16} className="mr-2" />
                  <span>Filter</span>
                </button>

                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <UserPlus size={16} className="mr-2" />
                  <span>Add Employee</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="divide-y divide-gray-200 text-gray-700">
                {getCurrentPageEmployees().map((employee) => (
                  <EmployeeRow
                    key={employee.id}
                    name={`${employee.firstName} ${employee.lastName}`}
                    position={employee.position}
                    location={getEmployeeLocation(employee)}
                    time={new Date().toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit',
                      hour12: false 
                    })}
                    department={employee.department}
                    avatar={getEmployeeAvatar(employee)}
                  />
                ))}
              </div>

              {getCurrentPageEmployees().length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  No employees found matching your criteria.
                </div>
              )}

              {totalPages > 1 && (
                <div className="p-4 flex justify-center">
                  <div className="flex space-x-2">
                    <button 
                      className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 disabled:opacity-50"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        className={`w-8 h-8 flex items-center justify-center rounded-md ${
                          currentPage === page 
                            ? 'bg-blue-500 text-white' 
                            : 'hover:bg-gray-100'
                        }`}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </button>
                    ))}
                    
                    <button 
                      className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 disabled:opacity-50"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <AddEmployeeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddEmployee}
        managers={managers}
      />
    </div>
  )
}

