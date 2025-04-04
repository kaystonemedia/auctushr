'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { BarChart } from '@/components/ui/charts'
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, differenceInHours } from 'date-fns'
import { AttendanceAnalytics, AttendanceRecord } from '@/types/attendance'

interface AnalyticsDashboardProps {
  viewMode?: 'personal' | 'managed' | 'all' // personal for employees, managed for managers, all for admins
  employeeId?: string // For personal view
}

export function AnalyticsDashboard({ viewMode = 'all', employeeId }: AnalyticsDashboardProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'year'>('week')
  const [analytics, setAnalytics] = useState<AttendanceAnalytics | null>(null)
  const [managedEmployees, setManagedEmployees] = useState<string[]>([])

  useEffect(() => {
    if (viewMode === 'managed') {
      fetchManagedEmployees()
    }
    fetchAnalytics()
  }, [timeframe, viewMode, employeeId])

  const fetchManagedEmployees = async () => {
    if (!user) return

    try {
      // First get all departments managed by this user
      const departmentsQuery = query(
        collection(db, 'departments'),
        where('managerId', '==', user.uid)
      )
      const departmentsSnapshot = await getDocs(departmentsQuery)
      const departmentIds = departmentsSnapshot.docs.map(doc => doc.id)

      // Then get all employees in these departments
      const employeesQuery = query(
        collection(db, 'users'),
        where('departmentId', 'in', departmentIds)
      )
      const employeesSnapshot = await getDocs(employeesQuery)
      const employeeIds = employeesSnapshot.docs.map(doc => doc.id)
      setManagedEmployees(employeeIds)
    } catch (error) {
      console.error('Error fetching managed employees:', error)
    }
  }

  const fetchAnalytics = async () => {
    if (!user) return

    try {
      setLoading(true)
      const dateRange = getDateRange(timeframe)
      
      // Build query based on view mode
      let attendanceQuery = query(
        collection(db, 'attendance'),
        where('date', '>=', dateRange.start),
        where('date', '<=', dateRange.end),
        orderBy('date', 'asc')
      )

      // Add filters based on view mode
      switch (viewMode) {
        case 'personal':
          attendanceQuery = query(
            attendanceQuery,
            where('employeeId', '==', employeeId || user.uid)
          )
          break
        case 'managed':
          if (managedEmployees.length > 0) {
            attendanceQuery = query(
              attendanceQuery,
              where('employeeId', 'in', managedEmployees)
            )
          }
          break
        // For 'all' viewMode, no additional filters needed
      }

      const querySnapshot = await getDocs(attendanceQuery)
      const records = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AttendanceRecord[]

      // Process analytics data
      const analyticsData = processAnalytics(records)
      setAnalytics(analyticsData)
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDateRange = (timeframe: string) => {
    const now = new Date()
    switch (timeframe) {
      case 'week':
        return {
          start: startOfWeek(now),
          end: endOfWeek(now)
        }
      case 'month':
        return {
          start: startOfMonth(now),
          end: endOfMonth(now)
        }
      case 'year':
        return {
          start: new Date(now.getFullYear(), 0, 1),
          end: new Date(now.getFullYear(), 11, 31)
        }
      default:
        return {
          start: subDays(now, 7),
          end: now
        }
    }
  }

  const processAnalytics = (records: AttendanceRecord[]): AttendanceAnalytics => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Calculate overview statistics based on view mode
    const overview = {
      totalEmployees: viewMode === 'personal' ? 1 : 
                     viewMode === 'managed' ? managedEmployees.length :
                     new Set(records.map(r => r.employeeId)).size,
      presentToday: records.filter(r => 
        r.date.toDateString() === today.toDateString() && r.status === 'present'
      ).length,
      absentToday: records.filter(r => 
        r.date.toDateString() === today.toDateString() && r.status === 'absent'
      ).length,
      lateToday: records.filter(r => 
        r.date.toDateString() === today.toDateString() && r.status === 'late'
      ).length,
      onLeaveToday: records.filter(r => 
        r.date.toDateString() === today.toDateString() && (r.status === 'early_leave' || r.status === 'half_day')
      ).length,
      averageAttendanceRate: calculateAttendanceRate(records)
    }

    // Calculate trends
    const trends = calculateTrends(records)

    // Calculate employee-wise statistics if not personal view
    const employeeStats = viewMode !== 'personal' ? 
      calculateEmployeeStats(records) : []

    // Calculate department-wise statistics
    const departmentWise = calculateDepartmentStats(records)

    return {
      overview,
      trends,
      employeeStats,
      departmentWise,
      predictions: {
        nextWeek: {
          expectedAttendance: overview.averageAttendanceRate,
          potentialAbsences: Math.round(overview.totalEmployees * (1 - overview.averageAttendanceRate / 100)),
          predictedLateArrivals: Math.round(overview.lateToday * 1.1) // Simple prediction based on current trend
        }
      }
    }
  }

  const calculateAttendanceRate = (records: AttendanceRecord[]) => {
    const totalDays = records.length
    const presentDays = records.filter(r => r.status === 'present').length
    return totalDays > 0 ? (presentDays / totalDays) * 100 : 0
  }

  const calculateTrends = (records: AttendanceRecord[]): AttendanceAnalytics['trends'] => {
    // Group records by date and calculate daily stats
    const dailyStats = new Map()
    records.forEach(record => {
      const dateKey = format(record.date, 'yyyy-MM-dd')
      if (!dailyStats.has(dateKey)) {
        dailyStats.set(dateKey, {
          date: record.date,
          present: 0,
          absent: 0,
          late: 0,
          onLeave: 0
        })
      }
      const stats = dailyStats.get(dateKey)
      if (record.status === 'present') stats.present++
      else if (record.status === 'absent') stats.absent++
      else if (record.status === 'late') stats.late++
      else if (record.status === 'early_leave' || record.status === 'half_day') stats.onLeave++
    })

    const daily = Array.from(dailyStats.values())

    // Calculate weekly trends
    const weeklyStats = new Map()
    records.forEach(record => {
      const weekStart = startOfWeek(record.date)
      const weekEnd = endOfWeek(record.date)
      const weekKey = format(weekStart, 'yyyy-MM-dd')
      
      if (!weeklyStats.has(weekKey)) {
        weeklyStats.set(weekKey, {
          weekStart,
          weekEnd,
          averageAttendance: 0,
          lateEntries: 0,
          earlyLeavers: 0
        })
      }
      
      const stats = weeklyStats.get(weekKey)
      if (record.status === 'present') stats.averageAttendance++
      else if (record.status === 'late') stats.lateEntries++
      else if (record.status === 'early_leave') stats.earlyLeavers++
    })

    const weekly = Array.from(weeklyStats.values()).map(stats => ({
      ...stats,
      averageAttendance: stats.averageAttendance / 7 * 100
    }))

    // Calculate monthly trends
    const monthlyStats = new Map()
    records.forEach(record => {
      const monthKey = format(record.date, 'yyyy-MM')
      if (!monthlyStats.has(monthKey)) {
        monthlyStats.set(monthKey, {
          month: startOfMonth(record.date),
          attendanceRate: 0,
          overtimeHours: 0,
          averageWorkHours: 0,
          totalDays: 0,
          presentDays: 0,
          totalWorkHours: 0
        })
      }
      
      const stats = monthlyStats.get(monthKey)
      stats.totalDays++
      if (record.status === 'present') {
        stats.presentDays++
        if (record.checkOut) {
          const workHours = differenceInHours(record.checkOut.time, record.checkIn.time)
          stats.totalWorkHours += workHours
          if (workHours > 8) {
            stats.overtimeHours += workHours - 8
          }
        }
      }
    })

    const monthly = Array.from(monthlyStats.values()).map(stats => ({
      month: stats.month,
      attendanceRate: (stats.presentDays / stats.totalDays) * 100,
      overtimeHours: stats.overtimeHours,
      averageWorkHours: stats.totalWorkHours / stats.totalDays
    }))

    return {
      daily,
      weekly,
      monthly
    }
  }

  const calculateEmployeeStats = (records: AttendanceRecord[]) => {
    const employeeStats = new Map()
    records.forEach(record => {
      if (!employeeStats.has(record.employeeId)) {
        employeeStats.set(record.employeeId, {
          employeeId: record.employeeId,
          name: record.employeeName,
          totalDays: 0,
          presentDays: 0,
          lateDays: 0,
          absentDays: 0
        })
      }
      const stats = employeeStats.get(record.employeeId)
      stats.totalDays++
      stats[`${record.status}Days`]++
    })

    return Array.from(employeeStats.values())
  }

  const calculateDepartmentStats = (records: AttendanceRecord[]) => {
    const departmentStats = new Map()
    records.forEach(record => {
      const department = record.department || 'Unassigned'
      if (!departmentStats.has(department)) {
        departmentStats.set(department, {
          department,
          totalEmployees: new Set(),
          attendanceRate: 0,
          lateCount: 0,
          absentCount: 0,
          totalRecords: 0
        })
      }
      const stats = departmentStats.get(department)
      stats.totalEmployees.add(record.employeeId)
      stats.totalRecords++
      if (record.status === 'late') stats.lateCount++
      else if (record.status === 'absent') stats.absentCount++
    })

    return Array.from(departmentStats.values()).map(stats => ({
      department: stats.department,
      totalEmployees: stats.totalEmployees.size,
      attendanceRate: ((stats.totalRecords - stats.absentCount) / stats.totalRecords) * 100,
      latePercentage: (stats.lateCount / stats.totalRecords) * 100,
      absentPercentage: (stats.absentCount / stats.totalRecords) * 100
    }))
  }

  if (loading) {
    return <div>Loading analytics...</div>
  }

  if (!analytics) {
    return <div>No data available</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">
          {viewMode === 'personal' ? 'My Attendance Analytics' :
           viewMode === 'managed' ? 'Team Analytics' :
           'Organization Analytics'}
        </h2>
        <Select
          value={timeframe}
          onValueChange={(value) => setTimeframe(value as typeof timeframe)}
        >
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="year">This Year</option>
        </Select>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-500">
            {viewMode === 'personal' ? 'My Attendance Rate' : 'Total Employees'}
          </h3>
          <p className="text-2xl font-bold">
            {viewMode === 'personal' ? 
              `${analytics.overview.averageAttendanceRate.toFixed(1)}%` :
              analytics.overview.totalEmployees}
          </p>
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-500">Present Today</h3>
          <p className="text-2xl font-bold text-green-600">{analytics.overview.presentToday}</p>
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-500">Late Today</h3>
          <p className="text-2xl font-bold text-yellow-600">{analytics.overview.lateToday}</p>
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-500">Absent Today</h3>
          <p className="text-2xl font-bold text-red-600">{analytics.overview.absentToday}</p>
        </Card>
      </div>

      {/* Attendance Trends */}
      <Card className="p-6">
        <h3 className="text-lg font-medium mb-4">Attendance Trends</h3>
        <div className="h-[300px]">
          <ResponsiveContainer>
            <RechartsLineChart data={analytics.trends.daily.map(day => ({
              name: format(day.date, 'MMM dd'),
              present: day.present,
              absent: day.absent,
              late: day.late,
              onLeave: day.onLeave
            }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="present" stroke="#4CAF50" name="Present" />
              <Line type="monotone" dataKey="absent" stroke="#F44336" name="Absent" />
              <Line type="monotone" dataKey="late" stroke="#FFC107" name="Late" />
              <Line type="monotone" dataKey="onLeave" stroke="#2196F3" name="On Leave" />
            </RechartsLineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Employee Statistics (only for managed and all views) */}
      {viewMode !== 'personal' && analytics.employeeStats.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">Employee Statistics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analytics.employeeStats.map(stat => (
              <Card key={stat.employeeId} className="p-4">
                <h4 className="font-medium">{stat.name}</h4>
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-gray-500">
                    Attendance Rate: {((stat.presentDays / stat.totalDays) * 100).toFixed(1)}%
                  </p>
                  <p className="text-sm text-gray-500">
                    Late Days: {stat.lateDays}
                  </p>
                  <p className="text-sm text-gray-500">
                    Absent Days: {stat.absentDays}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
} 