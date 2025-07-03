'use client'

import { useState, useEffect } from 'react'
import { useNewAuth } from '@/contexts/new-auth-context'
import { db } from '@/lib/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'

interface DebugData {
  managers: any[]
  employees: any[]
  assignments: any[]
}

export default function DebugAssignmentsPage() {
  const { user } = useNewAuth()
  const [debugData, setDebugData] = useState<DebugData>({ managers: [], employees: [], assignments: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchDebugData()
    }
  }, [user])

  const fetchDebugData = async () => {
    try {
      setLoading(true)
      
      // Fetch all managers from all collections
      const [usersSnapshot, managersSnapshot, employeesWithManagerRole] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('role', 'in', ['manager', 'admin']))),
        getDocs(collection(db, 'managers')),
        getDocs(query(collection(db, 'employees'), where('role', '==', 'manager')))
      ])

      // Fetch all employees
      const employeesSnapshot = await getDocs(collection(db, 'employees'))

      const managers = [
        ...usersSnapshot.docs.map(doc => ({ id: doc.id, collection: 'users', ...doc.data() })),
        ...managersSnapshot.docs.map(doc => ({ id: doc.id, collection: 'managers', ...doc.data() })),
        ...employeesWithManagerRole.docs.map(doc => ({ id: doc.id, collection: 'employees', ...doc.data() }))
      ]

      const employees = employeesSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }))

      // Create assignment analysis
      const assignments = employees
        .filter(emp => emp.managerId)
        .map(emp => {
          const manager = managers.find(mgr => mgr.uid === emp.managerId || mgr.id === emp.managerId)
          return {
            employeeId: emp.id,
            employeeName: `${emp.firstName} ${emp.lastName}`,
            employeeEmail: emp.email,
            managerId: emp.managerId,
            managerFound: !!manager,
            managerName: manager ? `${manager.firstName} ${manager.lastName}` : 'NOT FOUND',
            managerCollection: manager?.collection || 'N/A',
            managerUID: manager?.uid || 'N/A'
          }
        })

      setDebugData({ managers, employees, assignments })
    } catch (error) {
      console.error('Error fetching debug data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!user || user.role !== 'admin') {
    return <div>Access denied. Admin only.</div>
  }

  if (loading) {
    return <div>Loading debug data...</div>
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Debug Manager-Employee Assignments</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Managers */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">All Managers ({debugData.managers.length})</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {debugData.managers.map(manager => (
              <div key={`${manager.collection}-${manager.id}`} className="p-2 border rounded text-sm">
                <div className="font-medium">{manager.firstName} {manager.lastName}</div>
                <div className="text-gray-600">{manager.email}</div>
                <div className="text-xs text-blue-600">Collection: {manager.collection}</div>
                <div className="text-xs text-green-600">UID: {manager.uid || 'No UID'}</div>
                <div className="text-xs text-purple-600">Doc ID: {manager.id}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Employees */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">All Employees ({debugData.employees.length})</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {debugData.employees.map(employee => (
              <div key={employee.id} className="p-2 border rounded text-sm">
                <div className="font-medium">{employee.firstName} {employee.lastName}</div>
                <div className="text-gray-600">{employee.email}</div>
                <div className="text-xs text-orange-600">
                  Manager ID: {employee.managerId || 'Not assigned'}
                </div>
                <div className="text-xs text-purple-600">Employee Role: {employee.role}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Assignments Analysis */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Assignment Analysis ({debugData.assignments.length})</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {debugData.assignments.map((assignment, index) => (
              <div key={index} className={`p-2 border rounded text-sm ${assignment.managerFound ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                <div className="font-medium">{assignment.employeeName}</div>
                <div className="text-gray-600 text-xs">{assignment.employeeEmail}</div>
                <div className="text-xs">
                  <span className="text-orange-600">Manager ID: {assignment.managerId}</span>
                </div>
                <div className="text-xs">
                  <span className={assignment.managerFound ? 'text-green-600' : 'text-red-600'}>
                    Manager: {assignment.managerName}
                  </span>
                </div>
                {assignment.managerFound && (
                  <>
                    <div className="text-xs text-blue-600">Collection: {assignment.managerCollection}</div>
                    <div className="text-xs text-purple-600">Manager UID: {assignment.managerUID}</div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 bg-yellow-50 p-4 rounded-lg">
        <h3 className="font-semibold text-yellow-800">Issues to Look For:</h3>
        <ul className="text-sm text-yellow-700 mt-2 space-y-1">
          <li>• Red assignments = Manager not found (broken assignment)</li>
          <li>• Manager ID should match Manager UID for proper functioning</li>
          <li>• Managers might be in different collections (users, managers, employees)</li>
          <li>• Employee managerId should point to manager's UID, not document ID</li>
        </ul>
      </div>
    </div>
  )
} 