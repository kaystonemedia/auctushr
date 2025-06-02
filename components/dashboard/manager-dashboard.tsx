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
  getDocs
} from 'firebase/firestore'
import { StatsCard } from '@/components/ui/stats-card'
import { DepartmentChart } from '@/components/ui/department-chart'
import { QuickActionCard } from '@/components/ui/quick-action-card'
import { Users, Calendar, FileText, BarChart, CheckCircle, Clock, UserCheck, UserX, AlertCircle, BarChart3 } from 'lucide-react'
import { format } from 'date-fns'
import { Card } from '@/components/ui/card'
import { useRouter } from 'next/navigation'

const calculateTrend = (current: number, previous: number) => {
  if (previous === 0) return current > 0 ? '+100%' : '0%'
  const change = ((current - previous) / previous) * 100
  return `${change >= 0 ? '+' : ''}${Math.round(change)}%`
}

export default function ManagerDashboard() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({
    teamSize: 0,
    presentToday: 0,
    lateToday: 0,
    absentToday: 0,
    onLeaveToday: 0,
    pendingApprovals: 0,
    activeProjects: 0
  })
  const [previousStats, setPreviousStats] = useState({...stats})
  const [teamMembers, setTeamMembers] = useState<Array<{
    id: string
    name: string
    role: string
    status: string
    lastActive: Date
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
    // Check if auth is still loading
    if (authLoading) {
      console.log('Auth is still loading...')
      return
    }

    // Check if user is authenticated
    if (!user) {
      console.log('No authenticated user, redirecting to login...')
      router.push('/login')
      return
    }

    // Verify user role
    const checkUserRole = async () => {
      try {
        // Check both users and managers collections
        const [usersSnapshot, managersSnapshot] = await Promise.all([
          getDocs(query(
            collection(db, 'users'),
            where('uid', '==', user.uid),
            where('role', 'in', ['manager', 'admin'])
          )),
          getDocs(query(
            collection(db, 'managers'),
            where('uid', '==', user.uid)
          ))
        ]);

        if (usersSnapshot.empty && managersSnapshot.empty) {
          console.log('User is not a manager, redirecting...');
          router.push('/dashboard'); // Redirect to regular dashboard
          return;
        }

        // Get the user data from whichever collection has it
        const userData = usersSnapshot.docs[0]?.data() || managersSnapshot.docs[0]?.data();
        if (!userData) {
          console.log('No user data found, redirecting...');
          router.push('/dashboard');
          return;
        }

        console.log('Manager user verified, setting up listeners...');
        setupRealtimeListeners();
      } catch (error) {
        console.error('Error checking user role:', error);
        setError('Failed to verify manager access. Please try logging in again.');
        router.push('/login');
      }
    }

    checkUserRole()
  }, [user, authLoading, router])

  const setupRealtimeListeners = () => {
    if (!user) {
      console.error('No authenticated user when setting up listeners')
      return
    }

    console.log('Setting up realtime listeners for manager dashboard...', {
      userId: user.uid,
      email: user.email
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayEnd = new Date(today)
    todayEnd.setHours(23, 59, 59, 999)

    // Listen to team members
    const teamUnsubscribe = onSnapshot(
      query(
        collection(db, 'employees'),
        where('managerId', '==', user?.uid)
      ),
      (teamSnapshot) => {
        const teamMembersData = teamSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        console.log('Team members fetched:', {
          count: teamSnapshot.size,
          members: teamMembersData
        })
        setTeamMembers(teamMembersData)
        updateStats(teamSnapshot.docs.map(doc => doc.id))
      },
      (error) => {
        console.error('Error in team members listener:', error)
      }
    )

    // Listen to today's attendance for team
    const attendanceUnsubscribe = onSnapshot(
      query(
        collection(db, 'attendance'),
        where('date', '>=', Timestamp.fromDate(today)),
        where('date', '<=', Timestamp.fromDate(todayEnd))
      ),
      (attendanceSnapshot) => {
        const attendanceData = attendanceSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        console.log('Team attendance fetched:', {
          count: attendanceSnapshot.size,
          records: attendanceData
        })
        updateStats(teamMembers.map(m => m.id))
      },
      (error) => {
        console.error('Error in attendance listener:', error)
      }
    )

    // Listen to pending approvals for team
    const approvalsUnsubscribe = onSnapshot(
      query(
        collection(db, 'leave_requests'),
        where('status', '==', 'pending')
      ),
      (approvalsSnapshot) => {
        console.log('Team approvals update received:', approvalsSnapshot.size)
        updateStats(teamMembers.map(m => m.id))
      }
    )

    // Listen to active projects for team
    const projectsUnsubscribe = onSnapshot(
      query(
        collection(db, 'projects'),
        where('status', '==', 'active')
      ),
      (projectsSnapshot) => {
        console.log('Team projects update received:', projectsSnapshot.size)
        updateStats(teamMembers.map(m => m.id))
      }
    )

    // Listen to recent activity for team
    const activityUnsubscribe = onSnapshot(
      query(
        collection(db, 'activity_logs'),
        where('userId', 'in', teamMembers.map(m => m.id)),
        orderBy('timestamp', 'desc'),
        limit(5)
      ),
      (activitySnapshot) => {
        console.log('Team activity update received:', activitySnapshot.size)
        const activityData = activitySnapshot.docs.map(doc => ({
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || new Date()
        }))
        setRecentActivity(activityData)
      }
    )

    // Store all unsubscribe functions
    setUnsubscribers([
      teamUnsubscribe,
      attendanceUnsubscribe,
      approvalsUnsubscribe,
      projectsUnsubscribe,
      activityUnsubscribe
    ])
  }

  const updateStats = async (teamMemberIds: string[]) => {
    try {
      setLoading(true)
      
      console.log('Starting team stats update...', {
        teamMemberIds,
        teamSize: teamMemberIds.length
      })

      // Store current stats before updating
      setPreviousStats(stats)

      // Get latest data from all collections
      const [attendanceSnapshot, approvalsSnapshot, projectsSnapshot] = await Promise.all([
        // Get today's attendance
        getDocs(query(
          collection(db, 'attendance'),
          where('date', '>=', Timestamp.fromDate(new Date().setHours(0, 0, 0, 0))),
          where('date', '<=', Timestamp.fromDate(new Date().setHours(23, 59, 59, 999))),
          where('userId', 'in', teamMemberIds)
        )),
        // Get pending approvals
        getDocs(query(
          collection(db, 'leave_requests'),
          where('status', '==', 'pending'),
          where('userId', 'in', teamMemberIds)
        )),
        // Get active projects
        getDocs(query(
          collection(db, 'projects'),
          where('status', '==', 'active'),
          where('teamMembers', 'array-contains-any', teamMemberIds)
        ))
      ])

      // Log raw data for debugging
      console.log('Raw team data from collections:', {
        attendance: {
          count: attendanceSnapshot.size,
          docs: attendanceSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        },
        approvals: {
          count: approvalsSnapshot.size,
          docs: approvalsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        },
        projects: {
          count: projectsSnapshot.size,
          docs: projectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        }
      })

      // Process attendance
      const presentEmployeeIds = new Set()
      const lateEmployeeIds = new Set()
      const onLeaveEmployeeIds = new Set()

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

        if (data.status === 'early_leave' || data.status === 'half_day') {
          onLeaveEmployeeIds.add(employeeId)
        }
      })

      // Calculate attendance stats
      const teamSize = teamMemberIds.length
      const attendanceStats = {
        presentToday: presentEmployeeIds.size,
        lateToday: lateEmployeeIds.size,
        onLeaveToday: onLeaveEmployeeIds.size,
        absentToday: teamSize - 
          (presentEmployeeIds.size + lateEmployeeIds.size + onLeaveEmployeeIds.size)
      }

      console.log('Team attendance stats calculated:', {
        teamSize,
        ...attendanceStats,
        presentIds: Array.from(presentEmployeeIds),
        lateIds: Array.from(lateEmployeeIds),
        onLeaveIds: Array.from(onLeaveEmployeeIds)
      })

      // Update final stats
      const finalStats = {
        teamSize,
        ...attendanceStats,
        pendingApprovals: approvalsSnapshot.size,
        activeProjects: projectsSnapshot.size
      }

      console.log('Final team stats being set:', finalStats)
      setStats(finalStats)

    } catch (error) {
      console.error('Error updating team stats:', error)
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

  if (authLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <span className="ml-3">Loading authentication...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="bg-red-50 p-4 rounded-lg">
          <h2 className="text-red-800 font-semibold">Authentication Error</h2>
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

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="bg-yellow-50 p-4 rounded-lg">
          <h2 className="text-yellow-800 font-semibold">Authentication Required</h2>
          <p className="text-yellow-600">Please log in to access the manager dashboard.</p>
          <button 
            onClick={() => router.push('/login')}
            className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Manager Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatsCard 
          title="Team Size" 
          value={stats.teamSize} 
          valueColor="text-blue-600"
          icon={<Users className="h-6 w-6 text-blue-500" />}
          trend={calculateTrend(stats.teamSize, previousStats.teamSize)}
          trendColor={stats.teamSize >= previousStats.teamSize ? "text-green-500" : "text-red-500"}
          subtitle="Total team members"
        />
        <StatsCard 
          title="Present Today" 
          value={stats.presentToday} 
          valueColor="text-green-600"
          icon={<UserCheck className="h-6 w-6 text-green-500" />}
          trend={calculateTrend(stats.presentToday, previousStats.presentToday)}
          trendColor={stats.presentToday >= previousStats.presentToday ? "text-green-500" : "text-red-500"}
          subtitle={`${Math.round((stats.presentToday / stats.teamSize) * 100) || 0}% of team`}
        />
        <StatsCard 
          title="Late Today" 
          value={stats.lateToday} 
          valueColor="text-yellow-600"
          icon={<Clock className="h-6 w-6 text-yellow-500" />}
          trend={calculateTrend(stats.lateToday, previousStats.lateToday)}
          trendColor={stats.lateToday <= previousStats.lateToday ? "text-green-500" : "text-red-500"}
          subtitle={`${Math.round((stats.lateToday / stats.teamSize) * 100) || 0}% of team`}
        />
        <StatsCard 
          title="Absent Today" 
          value={stats.absentToday} 
          valueColor="text-red-600"
          icon={<UserX className="h-6 w-6 text-red-500" />}
          trend={calculateTrend(stats.absentToday, previousStats.absentToday)}
          trendColor={stats.absentToday <= previousStats.absentToday ? "text-green-500" : "text-red-500"}
          subtitle={`${Math.round((stats.absentToday / stats.teamSize) * 100) || 0}% of team`}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatsCard 
          title="On Leave Today" 
          value={stats.onLeaveToday} 
          valueColor="text-purple-600"
          icon={<Calendar className="h-6 w-6 text-purple-500" />}
          trend={calculateTrend(stats.onLeaveToday, previousStats.onLeaveToday)}
          trendColor={stats.onLeaveToday <= previousStats.onLeaveToday ? "text-green-500" : "text-red-500"}
          subtitle={`${Math.round((stats.onLeaveToday / stats.teamSize) * 100) || 0}% of team`}
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
        <StatsCard 
          title="Active Projects" 
          value={stats.activeProjects} 
          valueColor="text-indigo-600"
          icon={<BarChart3 className="h-6 w-6 text-indigo-500" />}
          trend={calculateTrend(stats.activeProjects, previousStats.activeProjects)}
          trendColor={stats.activeProjects >= previousStats.activeProjects ? "text-green-500" : "text-red-500"}
          subtitle="Current team projects"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Team Members</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Active</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {teamMembers.map((member) => (
                    <tr key={member.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                              <span className="text-gray-500 font-medium">
                                {member.name.split(' ').map(n => n[0]).join('')}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{member.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{member.role}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          member.status === 'active' ? 'bg-green-100 text-green-800' :
                          member.status === 'away' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {member.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(member.lastActive, 'MMM d, h:mm a')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                title="Team Overview"
                subtitle="View detailed team analytics"
                icon={<Users size={24} className="text-white" />}
                color="bg-blue-500"
                href="/team/overview"
              />
              <QuickActionCard
                title="Attendance Reports"
                subtitle="View team attendance"
                icon={<BarChart3 size={24} className="text-white" />}
                color="bg-green-500"
                href="/team/attendance"
              />
              <QuickActionCard
                title="Pending Approvals"
                subtitle={`${stats.pendingApprovals} items need attention`}
                icon={<AlertCircle size={24} className="text-white" />}
                color="bg-orange-500"
                href="/team/approvals"
              />
            </div>
          </Card>
        </div>
      </div>
    </>
  )
} 