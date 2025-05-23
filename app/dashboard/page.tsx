'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, Clock, FileText, Activity, BarChart3, Bell, Users, Wallet, LineChart, Settings } from 'lucide-react'
import Link from 'next/link'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore'
import AdminDashboard from '@/components/dashboard/admin-dashboard'

interface AttendanceRecord {
  status: 'present' | 'late' | 'absent'
  date: Date
  checkIn?: Date
  checkOut?: Date
}

interface MonthlyStats {
  totalDays: number
  presentDays: number
  absentDays: number
  lateDays: number
}

interface QuickActionCardProps {
  title: string
  subtitle: string
  icon: React.ReactNode
  color: string
  href: string
}

function QuickActionCard({ title, subtitle, icon, color, href }: QuickActionCardProps) {
  return (
    <Link href={href}>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <div className={`p-3 rounded-lg ${color}`}>
              {icon}
            </div>
            <div>
              <h3 className="font-medium">{title}</h3>
              <p className="text-sm text-gray-500">{subtitle}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function EmployeeDashboard({ user, todayAttendance, monthlyStats }: { 
  user: any, 
  todayAttendance: AttendanceRecord | null, 
  monthlyStats: MonthlyStats | null 
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Welcome back, {user?.name}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/attendance">
            <Clock className="h-4 w-4 mr-2" />
            View Attendance
          </Link>
        </Button>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickActionCard
          title="Attendance"
          subtitle="Check in/out and view history"
          icon={<Clock size={24} className="text-white" />}
          color="bg-blue-500"
          href="/attendance"
        />
        <QuickActionCard
          title="Documents"
          subtitle="Access your documents"
          icon={<FileText size={24} className="text-white" />}
          color="bg-orange-500"
          href="/documents"
        />
        <QuickActionCard
          title="Productivity"
          subtitle="Track your performance"
          icon={<Activity size={24} className="text-white" />}
          color="bg-green-500"
          href="/productivity"
        />
        <QuickActionCard
          title="Performance"
          subtitle="View your metrics"
          icon={<BarChart3 size={24} className="text-white" />}
          color="bg-purple-500"
          href="/performance"
        />
      </div>

      {/* Attendance Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Status</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {todayAttendance ? (
                <span className={
                  todayAttendance.status === 'present' ? 'text-green-600' :
                  todayAttendance.status === 'late' ? 'text-yellow-600' :
                  'text-red-600'
                }>
                  {todayAttendance.status.charAt(0).toUpperCase() + todayAttendance.status.slice(1)}
                </span>
              ) : (
                <span className="text-gray-500">Not Checked In</span>
              )}
            </div>
            {todayAttendance?.checkIn && (
              <p className="text-xs text-muted-foreground mt-1">
                Check-in: {todayAttendance.checkIn.toLocaleTimeString()}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Present Days</CardTitle>
            <Calendar className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthlyStats?.presentDays || 0}</div>
            <p className="text-xs text-muted-foreground">
              Out of {monthlyStats?.totalDays || 0} working days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Late Days</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthlyStats?.lateDays || 0}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Absent Days</CardTitle>
            <Calendar className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthlyStats?.absentDays || 0}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity and Notifications */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">Recent Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <Bell className="h-5 w-5 text-blue-500 mt-1" />
                <div>
                  <p className="text-sm font-medium">New Task Assigned</p>
                  <p className="text-xs text-gray-500">2 hours ago</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Bell className="h-5 w-5 text-green-500 mt-1" />
                <div>
                  <p className="text-sm font-medium">Leave Request Approved</p>
                  <p className="text-xs text-gray-500">1 day ago</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Bell className="h-5 w-5 text-orange-500 mt-1" />
                <div>
                  <p className="text-sm font-medium">Upcoming Performance Review</p>
                  <p className="text-xs text-gray-500">2 days ago</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">Performance Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Task Completion Rate</span>
                <span className="text-sm font-medium text-green-500">85%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Attendance Rate</span>
                <span className="text-sm font-medium text-blue-500">98%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Team Contribution</span>
                <span className="text-sm font-medium text-teal-500">92%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function ManagerDashboard({ user }: { user: any }) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Manager Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Welcome back, {user?.name}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickActionCard
          title="Team Management"
          subtitle="Manage your team members"
          icon={<Users size={24} className="text-white" />}
          color="bg-blue-500"
          href="/employees"
        />
        <QuickActionCard
          title="Attendance"
          subtitle="View team attendance"
          icon={<Clock size={24} className="text-white" />}
          color="bg-orange-500"
          href="/attendance"
        />
        <QuickActionCard
          title="Performance"
          subtitle="Team performance metrics"
          icon={<LineChart size={24} className="text-white" />}
          color="bg-green-500"
          href="/performance"
        />
        <QuickActionCard
          title="Payroll"
          subtitle="Manage team payroll"
          icon={<Wallet size={24} className="text-white" />}
          color="bg-purple-500"
          href="/payroll"
        />
      </div>

      {/* Team Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Size</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">Active members</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Present Today</CardTitle>
            <Clock className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">10</div>
            <p className="text-xs text-muted-foreground">Out of 12 members</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On Leave</CardTitle>
            <Calendar className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
            <p className="text-xs text-muted-foreground">Team members</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Performance</CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">92%</div>
            <p className="text-xs text-muted-foreground">Average completion rate</p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null)
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats | null>(null)

  useEffect(() => {
    const fetchAttendanceData = async () => {
      if (!user || user.role !== 'employee') {
        setLoading(false)
        return
      }

      try {
        // Get today's attendance
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayEnd = new Date(today)
        todayEnd.setHours(23, 59, 59, 999)

        const attendanceQuery = query(
          collection(db, 'attendance'),
          where('uid', '==', user.uid),
          where('date', '>=', Timestamp.fromDate(today)),
          where('date', '<=', Timestamp.fromDate(todayEnd))
        )

        const attendanceSnapshot = await getDocs(attendanceQuery)
        if (!attendanceSnapshot.empty) {
          const data = attendanceSnapshot.docs[0].data()
          setTodayAttendance({
            status: data.status,
            date: data.date.toDate(),
            checkIn: data.checkIn?.toDate(),
            checkOut: data.checkOut?.toDate()
          })
        }

        // Get monthly stats
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)

        const monthlyQuery = query(
          collection(db, 'attendance'),
          where('uid', '==', user.uid),
          where('date', '>=', Timestamp.fromDate(startOfMonth)),
          where('date', '<=', Timestamp.fromDate(endOfMonth))
        )

        const monthlySnapshot = await getDocs(monthlyQuery)
        const stats = {
          totalDays: monthlySnapshot.size,
          presentDays: monthlySnapshot.docs.filter(doc => doc.data().status === 'present').length,
          absentDays: monthlySnapshot.docs.filter(doc => doc.data().status === 'absent').length,
          lateDays: monthlySnapshot.docs.filter(doc => doc.data().status === 'late').length,
        }
        setMonthlyStats(stats)
      } catch (error) {
        console.error('Error fetching attendance data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAttendanceData()
  }, [user])

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="space-y-6">
      {user.role === 'employee' && (
        <EmployeeDashboard 
          user={user} 
          todayAttendance={todayAttendance} 
          monthlyStats={monthlyStats} 
        />
      )}
      {user.role === 'manager' && <ManagerDashboard user={user} />}
      {user.role === 'admin' && <AdminDashboard />}
    </div>
  )
} 