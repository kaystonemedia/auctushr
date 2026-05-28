'use client'

import { useState, useEffect } from 'react'
import { useNewAuth } from '@/contexts/new-auth-context'
import { EmployeeWellnessReport } from "@/components/employee-wellness-report"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { WellnessChart } from "@/components/wellness-chart"
import { Loader2 } from "lucide-react"

interface WellnessData {
  id: string
  employeeId: string
  name: string
  position: string
  avatar: string
  score: number
  scoreColor: string
  metrics: {
    name: string
    ratings: number[]
    selectedRating: number
    color: string
  }[]
  timestamp: Date
}

interface DepartmentWellness {
  name: string
  score: number
  color: string
}

export default function WellnessCheckInPage() {
  const { user } = useNewAuth()
  const [departments, setDepartments] = useState<DepartmentWellness[]>([])
  const [employees, setEmployees] = useState<WellnessData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadWellnessData()
  }, [])

  const loadWellnessData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/wellness/summary', { credentials: 'include' })
      if (!response.ok) throw new Error('Failed to load wellness data')
      const data = await response.json()

      setEmployees(
        ((data.employees || []) as WellnessData[]).map((employee) => ({
          ...employee,
          timestamp: new Date(employee.timestamp),
        }))
      )
      setDepartments((data.departments || []) as DepartmentWellness[])

    } catch (error) {
      console.error('Error loading wellness data:', error)
      setError('Failed to load wellness data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar activePath="/wellness-check-in" />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-4">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Loading wellness data...</span>
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
        <Sidebar activePath="/wellness-check-in" />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-4">
            <div className="max-w-7xl mx-auto">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="text-red-800 font-medium">Error</h3>
                <p className="text-red-600">{error}</p>
                <button 
                  onClick={loadWellnessData}
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
      <Sidebar activePath="/wellness-check-in" />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto p-4">
          <div className="max-w-7xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold">Wellness check-in</h1>
              <p className="text-gray-500">
                Here&apos;s your employee progress overview from the last 30 days.
              </p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
              <WellnessChart departments={departments} />
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-bold">Latest reports</h2>
              <p className="text-gray-500">
                {employees.length} wellness check-ins in the last 30 days
              </p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200">
              {employees.length > 0 ? (
                employees.map((employee) => (
                  <EmployeeWellnessReport key={employee.id} employee={employee} />
                ))
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <p>No wellness check-ins found in the last 30 days.</p>
                  <p className="text-sm mt-2">
                    Encourage your team to complete their wellness assessments.
                  </p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

