'use client'

import { useState, useEffect } from 'react'
import { useNewAuth } from '@/contexts/new-auth-context'
import { db } from '@/lib/firebase'
import { collection, query, getDocs, where, orderBy, limit, Timestamp } from 'firebase/firestore'
import { EmployeeWellnessReport } from "@/components/employee-wellness-report"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { WellnessChart } from "@/components/wellness-chart"
import { Loader2 } from "lucide-react"
import { Employee } from '@/types/employee'

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
      
      // Get wellness data from the last 30 days
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      // Get wellness check-ins
      const wellnessSnapshot = await getDocs(query(
        collection(db, 'wellness_checkins'),
        where('timestamp', '>=', Timestamp.fromDate(thirtyDaysAgo)),
        orderBy('timestamp', 'desc'),
        limit(50)
      ))

      // Get employees for reference
      const employeesSnapshot = await getDocs(collection(db, 'employees'))
      const employeesData: Employee[] = employeesSnapshot.docs.map(doc => {
        const data = doc.data() as Partial<Employee>
        return {
          id: doc.id,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          email: data.email || '',
          phone: data.phone || '',
          department: data.department || '',
          position: data.position || '',
          role: data.role as 'admin' | 'manager' | 'employee' || 'employee',
          managerId: data.managerId || null,
          hasPassword: data.hasPassword ?? false,
          hireDate: data.hireDate ? new Date(data.hireDate as any) : new Date(),
          salary: data.salary || 0,
          status: data.status as 'active' | 'inactive' | 'on_leave' || 'active',
          photoURL: data.photoURL || '',
          address: data.address || undefined,
          emergencyContact: data.emergencyContact || undefined,
          documents: data.documents || undefined,
          createdAt: data.createdAt ? new Date(data.createdAt as any) : new Date(),
          updatedAt: data.updatedAt ? new Date(data.updatedAt as any) : new Date(),
        }
      })

      // Process wellness data
      const wellnessData: WellnessData[] = []
      const departmentScores = new Map<string, { total: number; count: number }>()

      wellnessSnapshot.docs.forEach(doc => {
        const wellness = doc.data()
        const employee = employeesData.find(emp => emp.id === wellness.employeeId)
        
        if (!employee) return

        const score = calculateWellnessScore(wellness.metrics)
        const scoreColor = getScoreColor(score)

        wellnessData.push({
          id: doc.id,
          employeeId: wellness.employeeId,
          name: `${employee.firstName} ${employee.lastName}`,
          position: employee.position,
          avatar: employee.photoURL || `/placeholder.svg?height=40&width=40`,
          score,
          scoreColor,
          metrics: wellness.metrics || [],
          timestamp: wellness.timestamp?.toDate() || new Date()
        })

        // Aggregate department scores
        const dept = employee.department
        if (!departmentScores.has(dept)) {
          departmentScores.set(dept, { total: 0, count: 0 })
        }
        const deptData = departmentScores.get(dept)!
        deptData.total += score
        deptData.count += 1
      })

      // Calculate department averages
      const departmentColors = [
        'bg-blue-500',
        'bg-teal-500', 
        'bg-indigo-500',
        'bg-purple-500',
        'bg-orange-500',
        'bg-green-500'
      ]

      const departmentWellness: DepartmentWellness[] = Array.from(departmentScores.entries())
        .map(([name, data], index) => ({
          name,
          score: Math.round(data.total / data.count),
          color: departmentColors[index % departmentColors.length]
        }))
        .sort((a, b) => b.score - a.score)

      setEmployees(wellnessData)
      setDepartments(departmentWellness)

    } catch (error) {
      console.error('Error loading wellness data:', error)
      setError('Failed to load wellness data')
    } finally {
      setLoading(false)
    }
  }

  const calculateWellnessScore = (metrics: any[]): number => {
    if (!metrics || metrics.length === 0) return 0
    
    const totalScore = metrics.reduce((sum, metric) => {
      const rating = metric.selectedRating || 0
      const maxRating = Math.max(...(metric.ratings || [10]))
      return sum + (rating / maxRating) * 100
    }, 0)
    
    return Math.round(totalScore / metrics.length)
  }

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'bg-teal-500'
    if (score >= 60) return 'bg-blue-500'
    if (score >= 40) return 'bg-yellow-500'
    return 'bg-orange-500'
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

