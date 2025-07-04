"use client"

import { useState, useMemo, useEffect, useCallback } from 'react'
import { Employee } from '@/types/employee'
import { Edit2, Trash2, ChevronLeft, ChevronRight, Search, ChevronUp, ChevronDown, Loader2 } from 'lucide-react'
import { doc, getDoc, query, where, getDocs, collection, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase'

interface EmployeeTableProps {
  employees: Employee[]
  onEdit: (employee: Employee) => void
  onDelete: (employeeId: string) => void
  hideManagerColumn?: boolean
}

export function EmployeeTable({ employees, onEdit, onDelete, hideManagerColumn = false }: EmployeeTableProps) {
  const [sortField, setSortField] = useState<keyof Employee>('firstName')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDepartment, setFilterDepartment] = useState<string>('')
  const [loadingManagers, setLoadingManagers] = useState<Record<string, boolean>>({})
  const [managerNames, setManagerNames] = useState<Record<string, string>>({})
  const itemsPerPage = 10

  const departments = useMemo(() => {
    const depts = new Set(employees.map(emp => emp.department))
    return Array.from(depts)
  }, [employees])

  const filteredEmployees = useMemo(() => {
    return employees.filter(employee => {
      const matchesSearch = searchTerm === '' || 
        employee.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.email.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesDepartment = filterDepartment === '' || 
        employee.department === filterDepartment

      return matchesSearch && matchesDepartment
    })
  }, [employees, searchTerm, filterDepartment])

  const sortedEmployees = useMemo(() => {
    return [...filteredEmployees].sort((a, b) => {
      const aValue = a[sortField]
      const bValue = b[sortField]

      // Handle null/undefined values
      if (!aValue && !bValue) return 0
      if (!aValue) return 1
      if (!bValue) return -1

      // Compare values
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredEmployees, sortField, sortDirection])

  const totalPages = Math.ceil(sortedEmployees.length / itemsPerPage)
  const paginatedEmployees = sortedEmployees.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  // Memoize the current page's employees to prevent unnecessary re-renders
  const currentPageEmployees = useMemo(() => {
    return paginatedEmployees.map(emp => emp.managerId).filter(Boolean) as string[]
  }, [paginatedEmployees])

  // Memoize the fetchManagerName function
  const fetchManagerName = useCallback(async (managerId: string) => {
    // Skip if we already have the manager name or if it's already loading
    if (managerNames[managerId] || loadingManagers[managerId]) {
      return
    }

    try {
      setLoadingManagers(prev => ({ ...prev, [managerId]: true }))
      
      // Search for manager in multiple collections by document ID and UID
      const collections = ['users', 'employees', 'managers']
      let managerFound = false
      
      for (const collectionName of collections) {
        try {
          // First try to get by document ID (in case it's a document ID)
          const docRef = doc(db, collectionName, managerId)
          const docSnap = await getDoc(docRef)
          
          if (docSnap.exists()) {
            const data = docSnap.data()
            // Verify this is actually a manager/admin
            if (data.role === 'manager' || data.role === 'admin' || collectionName === 'managers') {
              setManagerNames(prev => ({
                ...prev,
                [managerId]: `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.email || 'Unknown Manager'
              }))
              managerFound = true
              break
            }
          }
          
          // If not found by document ID, try searching by UID field (for corrected assignments)
          if (!managerFound) {
            const uidQuery = query(
              collection(db, collectionName),
              where('uid', '==', managerId),
              limit(1)
            )
            const uidSnapshot = await getDocs(uidQuery)
            
            if (!uidSnapshot.empty) {
              const data = uidSnapshot.docs[0].data()
              // Verify this is actually a manager/admin
              if (data.role === 'manager' || data.role === 'admin' || collectionName === 'managers') {
                setManagerNames(prev => ({
                  ...prev,
                  [managerId]: `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.email || 'Unknown Manager'
                }))
                managerFound = true
                break
              }
            }
          }
        } catch (error) {
          // Continue to next collection if this one fails
          console.warn(`Error checking ${collectionName} for manager ${managerId}:`, error)
        }
      }
      
      // If manager not found in any collection, mark as not found
      if (!managerFound) {
        setManagerNames(prev => ({
          ...prev,
          [managerId]: 'Manager not found'
        }))
      }
      
    } catch (error) {
      console.error('Error fetching manager:', error)
      setManagerNames(prev => ({
        ...prev,
        [managerId]: 'Error loading manager'
      }))
    } finally {
      setLoadingManagers(prev => ({ ...prev, [managerId]: false }))
    }
  }, [managerNames, loadingManagers])

  // Update useEffect to use memoized values
  useEffect(() => {
    // Skip fetching manager names if manager column is hidden
    if (hideManagerColumn) return

    // Only fetch manager names for managers we haven't loaded yet
    const managersToFetch = currentPageEmployees.filter(
      managerId => !managerNames[managerId] && !loadingManagers[managerId]
    )

    // Fetch manager names in parallel
    Promise.all(managersToFetch.map(fetchManagerName))
      .catch(error => console.error('Error fetching managers:', error))
  }, [currentPageEmployees, fetchManagerName, managerNames, loadingManagers, hideManagerColumn])

  const handleSort = (field: keyof Employee) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getStatusColor = (status: Employee['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-50 text-green-700 border border-green-200'
      case 'inactive':
        return 'bg-red-50 text-red-700 border border-red-200'
      case 'on_leave':
        return 'bg-red-50 text-red-700 border border-red-200'
      default:
        return 'bg-red-50 text-red-700 border border-red-200'
    }
  }

  const SortIndicator = ({ field }: { field: keyof Employee }) => {
    if (sortField !== field) return null
    return sortDirection === 'asc' ? 
      <ChevronUp className="inline-block h-4 w-4 ml-1" /> : 
      <ChevronDown className="inline-block h-4 w-4 ml-1" />
  }

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Search and Filter Section */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-gray-50/50 p-4 rounded-lg border border-gray-200">
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Search employees..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-colors"
          />
          <Search className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
        </div>

        <select
          value={filterDepartment}
          onChange={(e) => setFilterDepartment(e.target.value)}
          className="w-full sm:w-48 py-2.5 px-3 border border-gray-300 rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-colors"
        >
          <option value="">All Departments</option>
          {departments.map(dept => (
            <option key={dept} value={dept}>{dept}</option>
          ))}
        </select>
      </div>

      {/* Mobile view */}
      <div className="md:hidden">
        <div className="space-y-4">
          {filteredEmployees.map((employee) => (
            <div
              key={employee.id}
              className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center space-x-3">
                                     <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                     <span className="text-sm font-medium text-gray-700">
                       {employee.firstName.charAt(0).toUpperCase()}
                     </span>
                   </div>
                   <div>
                     <h3 className="font-medium text-gray-900">{employee.firstName} {employee.lastName}</h3>
                     <p className="text-sm text-gray-500">{employee.email}</p>
                   </div>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  employee.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {employee.status}
                </span>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Department:</span>
                  <span className="text-sm font-medium">{employee.department}</span>
                </div>
                                 <div className="flex justify-between">
                   <span className="text-sm text-gray-500">Position:</span>
                   <span className="text-sm font-medium">{employee.position}</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-sm text-gray-500">Employee ID:</span>
                   <span className="text-sm font-medium">{employee.id}</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-sm text-gray-500">Phone:</span>
                   <span className="text-sm font-medium">{employee.phone}</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-sm text-gray-500">Hire Date:</span>
                   <span className="text-sm font-medium">
                     {new Date(employee.hireDate).toLocaleDateString()}
                   </span>
                 </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between">
                                 <button
                   onClick={() => onEdit(employee)}
                   className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
                 >
                   Edit
                 </button>
                 <button
                   onClick={() => onDelete(employee.id)}
                   className="px-3 py-1 text-sm text-red-600 hover:text-red-800 font-medium"
                 >
                   Delete
                 </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop view */}
      <div className="hidden md:block">
        {/* Table Section */}
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('firstName')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Employee</span>
                    <SortIndicator field="firstName" />
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('email')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Email</span>
                    <SortIndicator field="email" />
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('department')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Department</span>
                    <SortIndicator field="department" />
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('position')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Position</span>
                    <SortIndicator field="position" />
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Status</span>
                    <SortIndicator field="status" />
                  </div>
                </th>
                {!hideManagerColumn && (
                  <th
                    scope="col"
                    className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                  >
                    Manager
                  </th>
                )}
                <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedEmployees.length === 0 ? (
                <tr>
                  <td colSpan={hideManagerColumn ? 6 : 7} className="px-6 py-8 text-center text-sm text-gray-500">
                    No employees found
                  </td>
                </tr>
              ) : (
                paginatedEmployees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0 h-10 w-10">
                          <img
                            className="h-10 w-10 rounded-full ring-2 ring-gray-100 object-cover"
                            src={employee.photoURL || `https://ui-avatars.com/api/?name=${employee.firstName}+${employee.lastName}&background=random&color=fff`}
                            alt={`${employee.firstName} ${employee.lastName}`}
                          />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {employee.firstName} {employee.lastName}
                          </div>
                          <div className="text-sm text-gray-500">{employee.position}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{employee.email}</div>
                      {employee.phone && (
                        <div className="text-sm text-gray-500">{employee.phone}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{employee.department || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{employee.position || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(employee.status)}`}>
                        {employee.status.replace('_', ' ').charAt(0).toUpperCase() + employee.status.slice(1).replace('_', ' ')}
                      </span>
                    </td>
                    {!hideManagerColumn && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        {employee.managerId ? (
                          <div className="text-sm">
                            {loadingManagers[employee.managerId] ? (
                              <div className="flex items-center space-x-2 text-gray-500">
                                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                <span>Loading...</span>
                              </div>
                            ) : (
                              <span className={
                                managerNames[employee.managerId] === 'Manager not found' || 
                                managerNames[employee.managerId] === 'Error loading manager'
                                  ? 'text-red-600 font-medium'
                                  : managerNames[employee.managerId] === 'Unknown Manager'
                                  ? 'text-amber-600 font-medium'
                                  : 'text-gray-900'
                              }>
                                {managerNames[employee.managerId] || 'Loading...'}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500 italic">No manager assigned</span>
                        )}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button
                        onClick={() => onEdit(employee)}
                        className="inline-flex items-center justify-center h-8 w-8 text-gray-900 hover:text-white hover:bg-gray-900 rounded-full transition-colors"
                        title="Edit employee"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDelete(employee.id)}
                        className="inline-flex items-center justify-center h-8 w-8 text-gray-900 hover:text-white hover:bg-gray-900 rounded-full transition-colors"
                        title="Delete employee"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6">
            <div className="flex justify-between flex-1 sm:hidden">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-md hover:bg-gray-900 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="relative inline-flex items-center px-4 py-2 ml-3 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-md hover:bg-gray-900 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                  <span className="font-medium">
                    {Math.min(currentPage * itemsPerPage, sortedEmployees.length)}
                  </span>{' '}
                  of <span className="font-medium">{sortedEmployees.length}</span> results
                </p>
              </div>
              <div>
                <nav className="inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 text-gray-900 rounded-l-md border border-gray-300 bg-white text-sm font-medium hover:bg-gray-900 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <span className="sr-only">Previous</span>
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium transition-colors ${
                        currentPage === page
                          ? 'z-10 bg-gray-900 text-white border-gray-900'
                          : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-900 hover:text-white'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 text-gray-900 rounded-r-md border border-gray-300 bg-white text-sm font-medium hover:bg-gray-900 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <span className="sr-only">Next</span>
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 