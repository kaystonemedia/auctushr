'use client'

import { useState } from 'react'
import { useNewAuth } from '@/contexts/new-auth-context'

interface FixResult {
  employeeId: string
  employeeName: string
  oldManagerId: string
  newManagerId: string
  status: 'success' | 'failed' | 'no-change'
  error?: string
}

export default function FixAssignmentsPage() {
  const { user } = useNewAuth()
  const [isFixing, setIsFixing] = useState(false)
  const [results, setResults] = useState<FixResult[]>([])
  const [previewMode, setPreviewMode] = useState(true)

  const fixAssignments = async () => {
    if (!user || user.role !== 'admin') return
    
    setIsFixing(true)
    const fixResults: FixResult[] = []
    
    try {
      // Load all profiles once and derive managers/employees.
      const employeesResponse = await fetch('/api/employees', { credentials: 'include' })
      if (!employeesResponse.ok) {
        throw new Error('Failed to load employees')
      }
      const employeesPayload = await employeesResponse.json()
      const allProfiles = (employeesPayload.employees || []) as Array<{
        id: string
        uid?: string | null
        role?: string
        firstName?: string
        lastName?: string
        managerId?: string | null
      }>
      const allManagers = allProfiles.filter((profile) => profile.role === 'manager' || profile.role === 'admin')
      const allEmployees = allProfiles.filter((profile) => profile.role === 'employee')

      // Create a mapping of profile ID to auth UID for managers.
      const managerIdToUid: Record<string, string> = {}

      allManagers.forEach(manager => {
        if (manager.uid) {
          managerIdToUid[manager.id] = manager.uid
        }
      })

      console.log('Manager ID to UID mapping:', managerIdToUid)

      for (const employeeData of allEmployees) {
        const employeeId = employeeData.id
        const employeeName = `${employeeData.firstName || ''} ${employeeData.lastName || ''}`.trim() || employeeId
        
        // Skip if no managerId assigned
        if (!employeeData.managerId) {
          continue
        }

        const oldManagerId = employeeData.managerId
        
        // Check if managerId is already a UID (starts with a typical Firebase UID pattern)
        const isAlreadyUID = typeof oldManagerId === 'string' && oldManagerId.length > 20
        
        // If it's already a UID, check if it matches any manager's UID
        if (isAlreadyUID) {
          const managerExists = allManagers.some(mgr => mgr.uid === oldManagerId)
          if (managerExists) {
            fixResults.push({
              employeeId,
              employeeName,
              oldManagerId,
              newManagerId: oldManagerId,
              status: 'no-change'
            })
            continue
          }
        }
        
        // Try to find the correct UID
        let newManagerId: string | null = null
        
        // First, try direct document ID lookup
        if (managerIdToUid[oldManagerId]) {
          newManagerId = managerIdToUid[oldManagerId]
        } else {
          // If not found, try to find by partial match or other criteria
          const possibleManager = allManagers.find(mgr => 
            mgr.id === oldManagerId || mgr.uid === oldManagerId
          )
          
          if (possibleManager && possibleManager.uid) {
            newManagerId = possibleManager.uid
          }
        }
        
        if (newManagerId && newManagerId !== oldManagerId) {
          try {
            if (!previewMode) {
              const updateResponse = await fetch('/api/employees', {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: employeeId,
                  managerId: newManagerId
                })
              })
              if (!updateResponse.ok) {
                const payload = await updateResponse.json().catch(() => ({}))
                throw new Error(payload.error || 'Failed to update employee manager')
              }
            }
            
            fixResults.push({
              employeeId,
              employeeName,
              oldManagerId,
              newManagerId,
              status: 'success'
            })
            
            console.log(`${previewMode ? 'PREVIEW' : 'FIXED'}: ${employeeName} - ${oldManagerId} -> ${newManagerId}`)
          } catch (error) {
            fixResults.push({
              employeeId,
              employeeName,
              oldManagerId,
              newManagerId,
              status: 'failed',
              error: error instanceof Error ? error.message : 'Unknown error'
            })
          }
        } else {
          fixResults.push({
            employeeId,
            employeeName,
            oldManagerId,
            newManagerId: 'NOT FOUND',
            status: 'failed',
            error: 'Could not find matching manager UID'
          })
        }
      }
      
      setResults(fixResults)
      
    } catch (error) {
      console.error('Error fixing assignments:', error)
    } finally {
      setIsFixing(false)
    }
  }

  if (!user || user.role !== 'admin') {
    return <div>Access denied. Admin only.</div>
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Fix Manager-Employee Assignments</h1>
      
      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <div className="text-sm">
          <strong>Current User:</strong> {user?.email} | <strong>Role:</strong> {user?.role}
        </div>
      </div>

      <div className="mb-6 space-y-4">
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={previewMode}
              onChange={(e) => setPreviewMode(e.target.checked)}
              className="rounded"
            />
            <span>Preview Mode (don't actually update)</span>
          </label>
        </div>

        <button
          onClick={fixAssignments}
          disabled={isFixing}
          className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {isFixing ? 'Fixing...' : previewMode ? 'Preview Fix' : 'Fix Assignments'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">
            Fix Results ({results.length})
          </h2>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {results.map((result, index) => (
              <div
                key={index}
                className={`p-3 border rounded text-sm ${
                  result.status === 'success' ? 'border-green-200 bg-green-50' :
                  result.status === 'no-change' ? 'border-blue-200 bg-blue-50' :
                  'border-red-200 bg-red-50'
                }`}
              >
                <div className="font-medium">{result.employeeName}</div>
                <div className="text-xs text-gray-600">Employee ID: {result.employeeId}</div>
                <div className="text-xs">
                  <span className="text-orange-600">Old Manager ID: </span>
                  <span className="font-mono">{result.oldManagerId}</span>
                </div>
                <div className="text-xs">
                  <span className="text-green-600">New Manager ID: </span>
                  <span className="font-mono">{result.newManagerId}</span>
                </div>
                <div className="text-xs">
                  <span className={`font-medium ${
                    result.status === 'success' ? 'text-green-600' :
                    result.status === 'no-change' ? 'text-blue-600' :
                    'text-red-600'
                  }`}>
                    Status: {result.status.toUpperCase()}
                  </span>
                </div>
                {result.error && (
                  <div className="text-xs text-red-600 mt-1">
                    Error: {result.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 bg-yellow-50 p-4 rounded-lg">
        <h3 className="font-semibold text-yellow-800">How This Fix Works:</h3>
        <ul className="text-sm text-yellow-700 mt-2 space-y-1">
          <li>• Finds all managers from all collections (users, employees, managers)</li>
          <li>• Creates a mapping of document ID → UID for each manager</li>
          <li>• Updates employee managerId fields to use UID instead of document ID</li>
          <li>• Preview mode shows what would be changed without actually updating</li>
          <li>• Only updates records that actually need fixing</li>
        </ul>
      </div>
    </div>
  )
} 