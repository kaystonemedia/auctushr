'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
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

// Add this helper function at the top level
const calculateTrend = (current: number, previous: number) => {
  if (previous === 0) return current > 0 ? '+100%' : '0%'
  const change = ((current - previous) / previous) * 100
  return `${change >= 0 ? '+' : ''}${Math.round(change)}%`
}

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
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
          router.push('/login')
          return
        }

        // Check if we already have the user's role
        if (userRole) {
          if (userRole === 'admin') {
            console.log('Admin role verified, setting up dashboard...')
            setupRealtimeListeners()
          } else {
            console.log('User is not an admin, redirecting...')
            router.push('/dashboard')
          }
          return
        }

        // Get user's role from Firestore
        console.log('Fetching user role...', { uid: user.uid })
        const userDocRef = doc(db, 'users', user.uid)
        const userDoc = await getDoc(userDocRef)

        if (!userDoc.exists()) {
          console.log('No user document found, redirecting to login...')
          setError('User account not found. Please contact support.')
          router.push('/login')
          return
        }

        const userData = userDoc.data()
        const role = userData.role

        console.log('User role fetched:', { role, email: user.email })
        setUserRole(role)

        if (role === 'admin') {
          console.log('Admin access granted, setting up dashboard...')
          setupRealtimeListeners()
        } else {
          console.log('Insufficient permissions, redirecting...')
          router.push('/dashboard')
        }

      } catch (error) {
        console.error('Error initializing dashboard:', error)
        setError('Failed to initialize dashboard. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    initializeDashboard()
  }, [user, authLoading, userRole, router])

  const setupRealtimeListeners = () => {
    if (!user || userRole !== 'admin') {
      console.warn("Cannot setup listeners: Invalid user or role (user or role is missing or not 'admin'). Skipping setup.")
      return
    }

    console.log('Setting up admin dashboard listeners...', {
      userId: user.uid,
      email: user.email,
      role: userRole
    })

    // Listen to users collection (admins)
    const usersUnsubscribe = onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'admin')),
      (usersSnapshot) => {
        const adminUsers = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        console.log('Admin users fetched:', {
          count: usersSnapshot.size,
          users: adminUsers
        })
        updateStats()
      },
      (error) => {
        console.error('Error in users listener:', error)
      }
    )

    // Listen to employees collection
    const employeesUnsubscribe = onSnapshot(
      collection(db, 'employees'),
      (employeesSnapshot) => {
        const employees = employeesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        console.log('Employees fetched:', {
          count: employeesSnapshot.size,
          employees: employees
        })
        updateStats()
      },
      (error) => {
        console.error('Error in employees listener:', error)
      }
    )

    // Listen to today's attendance
    const attendanceUnsubscribe = onSnapshot(
      (() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);
        return query(
          collection(db, 'attendance'),
          where('date', '>=', Timestamp.fromDate(today)),
          where('date', '<=', Timestamp.fromDate(todayEnd))
        );
      })(),
      (attendanceSnapshot) => {
        console.log('Attendance update received:', attendanceSnapshot.size)
        updateStats()
      }
    )

    // Listen to pending approvals
    const approvalsUnsubscribe = onSnapshot(
      query(
        collection(db, 'leave_requests'),
        where('status', '==', 'pending')
      ),
      (approvalsSnapshot) => {
        console.log('Approvals update received:', approvalsSnapshot.size)
        updateStats()
      }
    )

    // Listen to recent activity
    const activityUnsubscribe = onSnapshot(
      query(
        collection(db, 'activity_logs'),
        orderBy('timestamp', 'desc'),
        limit(5)
      ),
      (activitySnapshot) => {
        console.log('Activity update received:', activitySnapshot.size)
        const activityData = activitySnapshot.docs.map(doc => ({
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || new Date()
        }))
        setRecentActivity(activityData)
      }
    )

    // Store all unsubscribe functions
    setUnsubscribers([
      usersUnsubscribe,
      employeesUnsubscribe,
      attendanceUnsubscribe,
      approvalsUnsubscribe,
      activityUnsubscribe
    ])
  }

  const updateStats = async () => {
    try {
      setLoading(true)
      
      // Store current stats before updating
      setPreviousStats(stats)

      console.log('Starting stats update...')

      // Get latest data from all collections
      const [usersSnapshot, employeesSnapshot, attendanceSnapshot, approvalsSnapshot] = await Promise.all([
        // Get admins
        getDocs(query(collection(db, 'users'), where('role', '==', 'admin'))),
        // Get employees
        getDocs(collection(db, 'employees')),
        // Get today's attendance
        (() => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const todayEnd = new Date(today);
          todayEnd.setHours(23, 59, 59, 999);
          return getDocs(query(
            collection(db, 'attendance'),
            where('date', '>=', Timestamp.fromDate(today)),
            where('date', '<=', Timestamp.fromDate(todayEnd))
          ));
        })(),
        // Get pending approvals
        getDocs(query(
          collection(db, 'leave_requests'),
          where('status', '==', 'pending')
        ))
      ])

      // Log raw data for debugging
      console.log('Raw data from collections:', {
        users: {
          count: usersSnapshot.size,
          docs: usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        },
        employees: {
          count: employeesSnapshot.size,
          docs: employeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        },
        attendance: {
          count: attendanceSnapshot.size,
          docs: attendanceSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        },
        approvals: {
          count: approvalsSnapshot.size,
          docs: approvalsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        }
      })

      // Calculate total employees (only count employees, not admins)
      const totalEmployees = employeesSnapshot.size;
      console.log("Total employees (from employees collection):", totalEmployees);

      // Process departments (using real backend data from "employeesSnapshot" only)
      const employeesByDepartment = new Map<string, number>();
      const departmentColors = new Map<string, string>();
      let colorIndex = 0;
      employeesSnapshot.docs.forEach(doc => {
         const data = doc.data();
         const dept = data.department || "Unassigned";
         employeesByDepartment.set(dept, (employeesByDepartment.get(dept) || 0) + 1);
         if (!departmentColors.has(dept)) {
            departmentColors.set(dept, DEPARTMENT_COLORS[colorIndex % DEPARTMENT_COLORS.length]);
            colorIndex++;
         }
      });
      const departmentStats = Array.from(employeesByDepartment.entries()).map(([dept, count]) => ({ department: dept, value: count, color: departmentColors.get(dept) || "bg-gray-500" })).sort((a, b) => b.value - a.value);
      setDepartmentData(departmentStats);

      // Process attendance (for "onLeaveToday")
      const onLeaveEmployeeIds = new Set()
      attendanceSnapshot.docs.forEach(doc => {
        const data = doc.data()
        if (data.status === "early_leave" || data.status === "half_day") {
          onLeaveEmployeeIds.add(data.userId)
        }
      })
      const onLeaveToday = onLeaveEmployeeIds.size

      // (Assume "activeProjects" and "pendingApprovals" are computed from "projects" and "leave_requests" collections, respectively.)
      const activeProjects = (await getDocs(query(collection(db, "projects"), where("status", "==", "active")))).size
      const pendingApprovals = (await getDocs(query(collection(db, "leave_requests"), where("status", "==", "pending")))).size

      // Process attendance
      const presentEmployeeIds = new Set()
      const lateEmployeeIds = new Set()

      attendanceSnapshot.docs.forEach(doc => {
        const data = doc.data()
        const employeeId = data.userId
        const checkInTime = data.checkIn?.time?.toDate()
        
        if (!checkInTime) return

        const isLate = checkInTime.getHours() > 9 || 
                      (checkInTime.getHours() === 9 && checkInTime.getMinutes() > 30)

        if (isLate) {
          lateEmployeeIds.add(employeeId)
        } else {
          presentEmployeeIds.add(employeeId)
        }
      })

      // Calculate attendance stats
      const attendanceStats = {
        presentToday: presentEmployeeIds.size,
        lateToday: lateEmployeeIds.size,
        onLeaveToday: onLeaveToday,
        absentToday: totalEmployees - 
          (presentEmployeeIds.size + lateEmployeeIds.size + onLeaveEmployeeIds.size)
      }

      // Update final stats (with "onLeaveToday", "activeProjects", and "pendingApprovals" from backend)
      const finalStats = {
        totalEmployees,
        departments: employeesByDepartment.size,
        activeProjects: activeProjects,
        pendingApprovals: pendingApprovals,
        onLeaveToday: onLeaveToday,
        presentToday: presentEmployeeIds.size,
        lateToday: lateEmployeeIds.size,
        absentToday: totalEmployees - 
          (presentEmployeeIds.size + lateEmployeeIds.size + onLeaveEmployeeIds.size)
      }
      console.log('Final stats (using real backend data):', finalStats)
      setStats(finalStats)

    } catch (error) {
      console.error('Error updating stats:', error)
      // Log the full error details
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        })
      }
    } finally {
      setLoading(false)
    }
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
        <span className="ml-3">Checking permissions...</span>
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
            onClick={() => router.push('/login')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Return to Login
          </button>
        </div>
      </div>
    )
  }

  // Show unauthorized state
  if (!user || userRole !== 'admin') {
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
          title="Absent Today" 
          value={stats.absentToday} 
          valueColor="text-red-600"
          icon={<UserX className="h-6 w-6 text-red-500" />}
          trend={calculateTrend(stats.absentToday, previousStats.absentToday)}
          trendColor={stats.absentToday <= previousStats.absentToday ? "text-green-500" : "text-red-500"}
          subtitle={`${Math.round((stats.absentToday / stats.totalEmployees) * 100) || 0}% of total`}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <StatsCard 
          title="On Leave Today" 
          value={stats.onLeaveToday} 
          valueColor="text-purple-600"
          icon={<Calendar className="h-6 w-6 text-purple-500" />}
          trend={calculateTrend(stats.onLeaveToday, previousStats.onLeaveToday)}
          trendColor={stats.onLeaveToday <= previousStats.onLeaveToday ? "text-green-500" : "text-red-500"}
          subtitle={`${Math.round((stats.onLeaveToday / stats.totalEmployees) * 100) || 0}% of total`}
        />
        <StatsCard 
          title="Pending Approvals" 
          value={stats.pendingApprovals} 
          valueColor="text-orange-600"
          icon={<AlertCircle className="h-6 w-6 text-orange-500" />}
          trend={calculateTrend(stats.pendingApprovals, previousStats.pendingApprovals)}
          trendColor={stats.pendingApprovals <= previousStats.pendingApprovals ? "text-green-500" : "text-red-500"}
          subtitle="Leave requests awaiting action"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Department Distribution</h2>
            <div className="h-[300px]">
              {/* <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={departmentData}
                    dataKey="value"
                    nameKey="department"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {departmentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer> */}
            </div>
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
            </div>
          </Card>
        </div>
      </div>
    </>
  )
} 