'use client'

import { useState, useEffect } from 'react'
import { useNewAuth } from '@/contexts/new-auth-context'
import { db } from '@/lib/firebase'
import { collection, query, getDocs, where, Timestamp } from 'firebase/firestore'
import { CalendarView } from "@/components/calendar-view"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { Filter, Calendar, Loader2 } from "lucide-react"

type AbsenceType = "Away" | "Public Holiday" | "Sick Leave" | "Vacation" | "Personal Leave"

interface Employee {
  id: string
  name: string
  position: string
  avatar: string
  absences: {
    type: AbsenceType
    startDay: number
    endDay: number
    startDate: Date
    endDate: Date
  }[]
}

export default function WhosAwayPage() {
  const { user } = useNewAuth()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [absenceCount, setAbsenceCount] = useState(0)

  // Get current month days
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    return Array.from({ length: daysInMonth }, (_, i) => i + 1)
  }

  const days = getDaysInMonth(currentMonth)

  useEffect(() => {
    loadAbsenceData()
  }, [currentMonth])

  const loadAbsenceData = async () => {
    try {
      setLoading(true)
      
      // Get start and end of current month
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59, 999)

      // Get leave requests for current month
      const leaveSnapshot = await getDocs(query(
        collection(db, 'leave_requests'),
        where('startDate', '>=', Timestamp.fromDate(startOfMonth)),
        where('startDate', '<=', Timestamp.fromDate(endOfMonth))
      ))

      // Get employees
      const employeesSnapshot = await getDocs(collection(db, 'employees'))
      const employeesData = employeesSnapshot.docs.map(doc => {
        const data = doc.data() as any
        return {
          id: doc.id,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          position: data.position || '',
          photoURL: data.photoURL || '',
        }
      })

      // Process leave requests
      const employeeAbsences = new Map<string, Employee>()

      leaveSnapshot.docs.forEach(doc => {
        const leaveData = doc.data()
        const employeeId = leaveData.employeeId || leaveData.userId
        
        if (!employeeId) return

        const employee = employeesData.find(emp => emp.id === employeeId)
        if (!employee) return

        const startDate = leaveData.startDate?.toDate() || new Date(leaveData.startDate)
        const endDate = leaveData.endDate?.toDate() || new Date(leaveData.endDate)
        
        const startDay = startDate.getDate()
        const endDay = endDate.getDate()

        const absence = {
          type: getAbsenceType(leaveData.type),
          startDay,
          endDay,
          startDate,
          endDate
        }

        if (!employeeAbsences.has(employeeId)) {
          employeeAbsences.set(employeeId, {
            id: employeeId,
            name: `${employee.firstName} ${employee.lastName}`,
            position: employee.position,
            avatar: employee.photoURL || `/placeholder.svg?height=40&width=40`,
            absences: []
          })
        }

        employeeAbsences.get(employeeId)!.absences.push(absence)
      })

      // Add public holidays (this would typically come from a settings or holidays collection)
      const publicHolidays = getPublicHolidays(currentMonth)
      publicHolidays.forEach(holiday => {
        // Add holiday to all employees
        employeeAbsences.forEach(employee => {
          employee.absences.push({
            type: 'Public Holiday',
            startDay: holiday.day,
            endDay: holiday.day,
            startDate: holiday.date,
            endDate: holiday.date
          })
        })
      })

      const employeesWithAbsences = Array.from(employeeAbsences.values())
      setEmployees(employeesWithAbsences)
      setAbsenceCount(employeesWithAbsences.length)

    } catch (error) {
      console.error('Error loading absence data:', error)
      setError('Failed to load absence data')
    } finally {
      setLoading(false)
    }
  }

  const getAbsenceType = (leaveType: string): AbsenceType => {
    switch (leaveType?.toLowerCase()) {
      case 'sick':
      case 'sick_leave':
        return 'Sick Leave'
      case 'vacation':
      case 'annual':
        return 'Vacation'
      case 'personal':
        return 'Personal Leave'
      default:
        return 'Away'
    }
  }

  const getPublicHolidays = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    
    // This is a simplified example - in a real app, you'd fetch this from a database
    const holidays = [
      // Example holidays - you'd want to make this configurable
      { day: 25, date: new Date(year, month, 25), name: 'Christmas' },
      { day: 1, date: new Date(year, month, 1), name: 'New Year' }
    ]

    return holidays.filter(holiday => holiday.date.getMonth() === month)
  }

  const getMonthName = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  const changeMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev)
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1)
      } else {
        newDate.setMonth(prev.getMonth() + 1)
      }
      return newDate
    })
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar activePath="/whos-away" />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-4">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Loading absence data...</span>
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
        <Sidebar activePath="/whos-away" />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-4">
            <div className="max-w-7xl mx-auto">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="text-red-800 font-medium">Error</h3>
                <p className="text-red-600">{error}</p>
                <button 
                  onClick={loadAbsenceData}
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
      <Sidebar activePath="/whos-away" />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto p-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-700">Who&apos;s away</h1>
                <p className="text-gray-500">{absenceCount} people away this month</p>
              </div>

              <div className="flex space-x-4">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-rose-200 mr-2"></div>
                    <span className="text-sm text-gray-600">Away</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-indigo-200 mr-2"></div>
                    <span className="text-sm text-gray-600">Public Holiday</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-yellow-200 mr-2"></div>
                    <span className="text-sm text-gray-600">Sick Leave</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-green-200 mr-2"></div>
                    <span className="text-sm text-gray-600">Vacation</span>
                  </div>
                </div>

                <button className="flex items-center px-3 py-2 bg-gray-100 rounded-md hover:bg-gray-200">
                  <Calendar size={16} className="mr-2" />
                  <span>Add to calendar</span>
                </button>

                <button className="flex items-center px-3 py-2 bg-gray-100 rounded-md hover:bg-gray-200">
                  <Filter size={16} className="mr-2" />
                  <span>Filter</span>
                </button>
              </div>
            </div>

            <div className="mb-4 flex justify-between items-center">
              <button 
                onClick={() => changeMonth('prev')}
                className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200"
              >
                ← Previous
              </button>
              <h2 className="text-lg font-semibold">{getMonthName(currentMonth)}</h2>
              <button 
                onClick={() => changeMonth('next')}
                className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200"
              >
                Next →
              </button>
            </div>

            <CalendarView 
              month={getMonthName(currentMonth)} 
              days={days} 
              employees={employees.map(emp => ({
                name: emp.name,
                position: emp.position,
                avatar: emp.avatar,
                absences: emp.absences
                  .filter(abs => abs.type === 'Away' || abs.type === 'Public Holiday')
                  .map(({ type, startDay, endDay }) => ({
                    type: type as 'Away' | 'Public Holiday',
                    startDay,
                    endDay
                  }))
              }))}
            />
          </div>
        </main>
      </div>
    </div>
  )
}

