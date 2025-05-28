'use client'

import { useState, useEffect } from 'react'
import { useNewAuth } from '@/contexts/new-auth-context'
import { db } from '@/lib/firebase'
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  Timestamp,
  onSnapshot,
  Unsubscribe,
  getDocs,
  doc,
  getDoc
} from 'firebase/firestore'
import { StatsCard } from '@/components/ui/stats-card'
import { DepartmentChart } from '@/components/ui/department-chart'
import { QuickActionCard } from '@/components/ui/quick-action-card'
import { Users, Building2, BarChart3, Settings, BarChart, Clock, FileText, UserCheck, UserX, AlertCircle, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'

// Define department colors for consistency
const DEPARTMENT_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-indigo-500',
  'bg-purple-500',
  'bg-orange-500',
  'bg-teal-500',
  'bg-cyan-500',
  'bg-pink-500',
  'bg-yellow-500',
  'bg-red-500'
] as const

interface Department {
  id: string
  name: string
  employeeCount: number
  color: string
}

export default function AdminDashboard() {
  const { user, isLoading: authLoading } = useNewAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({
    totalEmployees: 0,
    departments: 0,
    activeProjects: 0,
    pendingApprovals: 0,
    presentToday: 0,
    lateToday: 0,
    absentToday: 0,
    onLeaveToday: 0
  })
  const [previousStats, setPreviousStats] = useState({...stats})
  const [departmentData, setDepartmentData] = useState<Array<{
    department: string
    value: number
    color: string
  }>>([])
  const [recentActivity, setRecentActivity] = useState<Array<{
    type: string
    description: string
    timestamp: Date
    user: string
  }>>([])

  // Store unsubscribe functions
  const [unsubscribers, setUnsubscribers] = useState<Unsubscribe[]>([])

  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        // If auth is still initializing, wait
        if (authLoading) {
          console.log('Auth is still initializing...')
          return
        }

        // If no user, redirect to login
        if (!user) {
          console.log('No user found, redirecting to login...')
          router.push('/auth/sign-in')
          return
        }

        // Check if user is admin
        if (user.role !== 'admin') {
          console.log('User is not an admin, redirecting...')
          router.push('/dashboard')
          return
        }

        console.log('Admin access granted, setting up dashboard...')
        setupRealtimeListeners()

      } catch (error) {
        console.error('Error initializing dashboard:', error)
        setError('Failed to initialize dashboard. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    initializeDashboard()

    // Cleanup function
    return () => {
      console.log('Cleaning up dashboard listeners...')
      unsubscribers.forEach(unsubscribe => unsubscribe())
    }
  }, [user, authLoading, router])

  const setupRealtimeListeners = () => {
    if (!user || user.role !== 'admin') {
      console.warn("Cannot setup listeners: Invalid user or role")
      return
    }

    console.log('Setting up admin dashboard listeners...', {
      userId: user.id,
      email: user.email,
      role: user.role
    })

    // Listen to users collection
    const usersUnsubscribe = onSnapshot(
      query(collection(db, 'users')),
      (usersSnapshot) => {
        const users = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        console.log('Users fetched:', {
          count: usersSnapshot.size,
          users: users
        })
        updateStats()
      },
      (error) => {
        console.error('Error in users listener:', error)
      }
    )

    // Listen to attendance collection for today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayEnd = new Date(today)
    todayEnd.setHours(23, 59, 59, 999)

    const attendanceUnsubscribe = onSnapshot(
      query(
        collection(db, 'attendance'),
        where('date', '>=', Timestamp.fromDate(today)),
        where('date', '<=', Timestamp.fromDate(todayEnd))
      ),
      (attendanceSnapshot) => {
        const attendance = attendanceSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        console.log('Today\'s attendance fetched:', {
          count: attendanceSnapshot.size,
          attendance: attendance
        })
        updateStats()
      },
      (error) => {
        console.error('Error in attendance listener:', error)
      }
    )

    // Listen to leave requests
    const leaveUnsubscribe = onSnapshot(
      query(
        collection(db, 'leave_requests'),
        where('status', '==', 'pending')
      ),
      (leaveSnapshot) => {
        const leaveRequests = leaveSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        console.log('Leave requests fetched:', {
          count: leaveSnapshot.size,
          requests: leaveRequests
        })
        updateStats()
      },
      (error) => {
        console.error('Error in leave requests listener:', error)
      }
    )

    // Store unsubscribe functions
    setUnsubscribers([usersUnsubscribe, attendanceUnsubscribe, leaveUnsubscribe])
  }

  const updateStats = async () => {
    try {
      setLoading(true)
      
      // Store current stats before updating
      setPreviousStats(stats)

      console.log('Starting stats update...')

      // Get latest data from all collections
      const [usersSnapshot, attendanceSnapshot, leaveSnapshot] = await Promise.all([
        getDocs(collection(db, 'users')),
        (() => {
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const todayEnd = new Date(today)
          todayEnd.setHours(23, 59, 59, 999)
          return getDocs(query(
            collection(db, 'attendance'),
            where('date', '>=', Timestamp.fromDate(today)),
            where('date', '<=', Timestamp.fromDate(todayEnd))
          ))
        })(),
        getDocs(query(
          collection(db, 'leave_requests'),
          where('status', '==', 'pending')
        ))
      ])

      // Calculate statistics
      const totalEmployees = usersSnapshot.size
      const departments = new Set(usersSnapshot.docs.map(doc => doc.data().department)).size
      const attendance = attendanceSnapshot.docs.map(doc => doc.data())
      const presentToday = attendance.filter(a => a.status === 'present').length
      const lateToday = attendance.filter(a => a.status === 'late').length
      const absentToday = attendance.filter(a => a.status === 'absent').length
      const onLeaveToday = attendance.filter(a => a.status === 'leave').length
      const pendingApprovals = leaveSnapshot.size

      // Update department data
      const deptData = Array.from(new Set(usersSnapshot.docs.map(doc => doc.data().department)))
        .map((dept, index) => ({
          department: dept,
          value: usersSnapshot.docs.filter(doc => doc.data().department === dept).length,
          color: DEPARTMENT_COLORS[index % DEPARTMENT_COLORS.length]
        }))

      // Update state
      setStats({
        totalEmployees,
        departments,
        activeProjects: 0, // TODO: Implement project tracking
        pendingApprovals,
        presentToday,
        lateToday,
        absentToday,
        onLeaveToday
      })
      setDepartmentData(deptData)

      // Update recent activity
      const activity = attendanceSnapshot.docs
        .map(doc => ({
          type: 'attendance',
          description: `${doc.data().userName} marked as ${doc.data().status}`,
          timestamp: doc.data().date.toDate(),
          user: doc.data().userName
        }))
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 5)

      setRecentActivity(activity)

    } catch (error) {
      console.error('Error updating stats:', error)
      setError('Failed to update dashboard statistics')
    } finally {
      setLoading(false)
    }
  }

  const calculateTrend = (current: number, previous: number) => {
    if (previous === 0) return 0
    return ((current - previous) / previous) * 100
  }

  // Show loading state while auth is initializing
  if (authLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <span className="ml-3">Initializing...</span>
      </div>
    )
  }

  // Show loading state while checking permissions
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <span className="ml-3">Loading dashboard...</span>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="bg-red-50 p-4 rounded-lg">
          <h2 className="text-red-800 font-semibold">Error</h2>
          <p className="text-red-600">{error}</p>
          <button 
            onClick={() => router.push('/auth/sign-in')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Return to Login
          </button>
        </div>
      </div>
    )
  }

  // Show unauthorized state
  if (!user || user.role !== 'admin') {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="bg-yellow-50 p-4 rounded-lg">
          <h2 className="text-yellow-800 font-semibold">Access Denied</h2>
          <p className="text-yellow-600">You don't have permission to access the admin dashboard.</p>
          <button 
            onClick={() => router.push('/dashboard')}
            className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatsCard 
          title="Total Employees" 
          value={stats.totalEmployees} 
          valueColor="text-blue-600"
          icon={<Users className="h-6 w-6 text-blue-500" />}
          trend={calculateTrend(stats.totalEmployees, previousStats.totalEmployees)}
          trendColor={stats.totalEmployees >= previousStats.totalEmployees ? "text-green-500" : "text-red-500"}
          subtitle={`Across ${stats.departments} departments`}
        />
        <StatsCard 
          title="Present Today" 
          value={stats.presentToday} 
          valueColor="text-green-600"
          icon={<UserCheck className="h-6 w-6 text-green-500" />}
          trend={calculateTrend(stats.presentToday, previousStats.presentToday)}
          trendColor={stats.presentToday >= previousStats.presentToday ? "text-green-500" : "text-red-500"}
          subtitle={`${Math.round((stats.presentToday / stats.totalEmployees) * 100) || 0}% of total`}
        />
        <StatsCard 
          title="Late Today" 
          value={stats.lateToday} 
          valueColor="text-yellow-600"
          icon={<Clock className="h-6 w-6 text-yellow-500" />}
          trend={calculateTrend(stats.lateToday, previousStats.lateToday)}
          trendColor={stats.lateToday <= previousStats.lateToday ? "text-green-500" : "text-red-500"}
          subtitle={`${Math.round((stats.lateToday / stats.totalEmployees) * 100) || 0}% of total`}
        />
        <StatsCard 
          title="Pending Approvals" 
          value={stats.pendingApprovals} 
          valueColor="text-orange-600"
          icon={<AlertCircle className="h-6 w-6 text-orange-500" />}
          trend={calculateTrend(stats.pendingApprovals, previousStats.pendingApprovals)}
          trendColor={stats.pendingApprovals <= previousStats.pendingApprovals ? "text-green-500" : "text-red-500"}
          subtitle="Leave requests awaiting approval"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Department Distribution</h2>
            <DepartmentChart data={departmentData} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-2 h-2 mt-2 rounded-full bg-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">{activity.description}</p>
                    <p className="text-xs text-gray-400">
                      {format(activity.timestamp, 'MMM d, h:mm a')} • {activity.user}
                    </p>
                  </div>
                </div>
              ))}
              {recentActivity.length === 0 && (
                <p className="text-sm text-gray-500">No recent activity</p>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 gap-4">
              <QuickActionCard
                title="Manage Employees"
                subtitle="Add, edit, or remove employees"
                icon={<Users size={24} className="text-white" />}
                color="bg-blue-500"
                href="/employees"
              />
              <QuickActionCard
                title="Attendance Reports"
                subtitle="View attendance analytics"
                icon={<BarChart3 size={24} className="text-white" />}
                color="bg-green-500"
                href="/attendance/reports"
              />
              <QuickActionCard
                title="Pending Approvals"
                subtitle={`${stats.pendingApprovals} items need attention`}
                icon={<AlertCircle size={24} className="text-white" />}
                color="bg-orange-500"
                href="/approvals"
              />
              <QuickActionCard
                title="Department Management"
                subtitle="Manage departments and teams"
                icon={<Building2 size={24} className="text-white" />}
                color="bg-indigo-500"
                href="/departments"
              />
            </div>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">System Health</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Database Status</p>
                <p className="text-2xl font-bold text-green-500">Healthy</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-green-500"></div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">API Status</p>
                <p className="text-2xl font-bold text-green-500">Operational</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-green-500"></div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Storage Usage</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Database Storage</p>
                <p className="text-2xl font-bold text-blue-500">45%</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-blue-500"></div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">File Storage</p>
                <p className="text-2xl font-bold text-blue-500">32%</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-blue-500"></div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </>
  )
} 