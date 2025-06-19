'use client'

import { useState, useEffect } from 'react'
import { useNewAuth } from '@/contexts/new-auth-context'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import Link from "next/link"

interface AttendanceRecord {
  status: 'present' | 'late' | 'absent'
  date: Date
  uid: string
}

interface MonthlyStats {
  totalDays: number
  presentDays: number
  absentDays: number
  lateDays: number
}

export default function EmployeeDashboard() {
  const { user, firebaseUser, isLoading: authLoading } = useNewAuth()
  const [loading, setLoading] = useState(true)
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null)
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats | null>(null)
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([])

  useEffect(() => {
    const fetchAttendanceData = async () => {
      try {
        setLoading(true)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)

        console.log('Fetching today\'s attendance...')
        const attendanceQuery = query(
          collection(db, 'attendance'),
          where('employeeId', '==', firebaseUser.uid),
          where('date', '>=', Timestamp.fromDate(today)),
          where('date', '<', Timestamp.fromDate(tomorrow))
        )

        console.log('Fetching today\'s attendance...')
        const attendanceSnapshot = await getDocs(attendanceQuery)
        console.log('Today\'s attendance snapshot:', attendanceSnapshot.docs.map(doc => doc.data()))
        
        if (!attendanceSnapshot.empty) {
          const data = attendanceSnapshot.docs[0].data()
          const attendanceData = {
            id: attendanceSnapshot.docs[0].id,
            ...data,
            date: data.date?.toDate() || new Date(),
            checkIn: {
              ...data.checkIn,
              time: data.checkIn?.time?.toDate() || new Date(),
              location: data.checkIn?.location || null,
              deviceInfo: data.checkIn?.deviceInfo || null
            },
            checkOut: data.checkOut ? {
              ...data.checkOut,
              time: data.checkOut.time?.toDate() || new Date(),
              location: data.checkOut.location || null,
              deviceInfo: data.checkOut.deviceInfo || null
            } : undefined
          } as AttendanceRecord
          console.log('Setting today\'s attendance:', attendanceData)
          setTodayAttendance(attendanceData)
        } else {
          console.log('No attendance record found for today')
        }

        // Get monthly stats
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)

        console.log('Fetching monthly stats...')
        const monthlyQuery = query(
          collection(db, 'attendance'),
          where('employeeId', '==', firebaseUser.uid),
          where('date', '>=', Timestamp.fromDate(startOfMonth)),
          where('date', '<=', Timestamp.fromDate(endOfMonth))
        )

        const monthlySnapshot = await getDocs(monthlyQuery)
        console.log('Monthly attendance records:', monthlySnapshot.docs.map(doc => doc.data()))
        
        const stats = {
          totalDays: monthlySnapshot.size,
          presentDays: monthlySnapshot.docs.filter(doc => doc.data().status === 'present').length,
          absentDays: monthlySnapshot.docs.filter(doc => doc.data().status === 'absent').length,
          lateDays: monthlySnapshot.docs.filter(doc => doc.data().status === 'late').length,
        } as MonthlyStats
        console.log('Setting monthly stats:', stats)
        setMonthlyStats(stats)
      } catch (error) {
        console.error('Error fetching attendance data:', error)
      } finally {
        setLoading(false)
      }
    }

    if (!authLoading && firebaseUser) {
      console.log('Auth loading complete, user available, fetching data...')
      fetchAttendanceData()
    } else {
      console.log('Auth still loading or no user:', { authLoading, firebaseUser })
    }
  }, [firebaseUser, authLoading])

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Employee Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Welcome back, {user?.name || 'Employee'}</p>
        </div>
        <div className="flex items-center space-x-4">
          <Button variant="outline" asChild>
            <Link href="/attendance">
              <Calendar className="h-4 w-4 mr-2" />
              View Attendance
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Status</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {todayAttendance ? (
                <span className={todayAttendance.status === 'present' ? 'text-green-600' : 
                               todayAttendance.status === 'late' ? 'text-yellow-600' : 
                               'text-red-600'}>
                  {todayAttendance.status.charAt(0).toUpperCase() + todayAttendance.status.slice(1)}
                </span>
              ) : (
                <span className="text-gray-500">Not Checked In</span>
              )}
            </div>
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                {todayAttendance ? 'Your attendance is recorded' : 'Please check in for today'}
              </p>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/attendance">
                  <Calendar className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Present Days</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthlyStats?.presentDays || 0}</div>
            <p className="text-xs text-muted-foreground">
              Out of {monthlyStats?.totalDays || 0} working days
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Late Days</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthlyStats?.lateDays || 0}</div>
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Absent Days</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthlyStats?.absentDays || 0}</div>
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <Button variant="outline" className="h-auto py-4" asChild>
                <Link href="/leave">
                  <Calendar className="h-4 w-4 mr-2" />
                  Request Leave
                </Link>
              </Button>
              <Button variant="outline" className="h-auto py-4" asChild>
                <Link href="/attendance">
                  <Clock className="h-4 w-4 mr-2" />
                  Check Attendance
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              No recent activity to show
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 