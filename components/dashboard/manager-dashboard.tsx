'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { db } from '@/lib/firebase'
import { collection, query, getDocs, where } from 'firebase/firestore'
import { StatsCard } from '@/components/ui/stats-card'
import { DepartmentChart } from '@/components/ui/department-chart'
import { QuickActionCard } from '@/components/ui/quick-action-card'
import { Users, Calendar, FileText, BarChart, CheckCircle, Clock } from 'lucide-react'

interface TeamMember {
  id: string
  name: string
  status: 'present' | 'absent' | 'on-leave'
  tasks: {
    completed: number
    pending: number
  }
}

export default function ManagerDashboard() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    teamMembers: 0,
    presentToday: 0,
    onLeave: 0,
    pendingTasks: 0
  })
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [teamPerformance, setTeamPerformance] = useState([
    { department: "Team A", value: 0, color: "bg-blue-500" },
    { department: "Team B", value: 0, color: "bg-teal-500" },
    { department: "Team C", value: 0, color: "bg-indigo-500" },
  ])

  useEffect(() => {
    if (user) {
      fetchManagerData()
    }
  }, [user])

  const fetchManagerData = async () => {
    try {
      setLoading(true)
      
      // Fetch team members under this manager
      const teamSnapshot = await getDocs(
        query(collection(db, 'employees'), where('managerId', '==', user?.uid))
      )
      
      const teamData: TeamMember[] = []
      let presentCount = 0
      let onLeaveCount = 0
      let totalPendingTasks = 0
      let totalCompletedTasks = 0

      for (const memberDoc of teamSnapshot.docs) {
        const memberData = memberDoc.data()
        
        // Get attendance status for today
        const today = new Date().toISOString().split('T')[0]
        const attendanceSnapshot = await getDocs(
          query(
            collection(db, 'attendance'),
            where('employeeId', '==', memberDoc.id),
            where('date', '==', today)
          )
        )
        
        const status = attendanceSnapshot.empty ? 'absent' : 
          attendanceSnapshot.docs[0].data().status || 'absent'

        // Get tasks for this employee
        const tasksSnapshot = await getDocs(
          query(collection(db, 'tasks'), where('assignedTo', '==', memberDoc.id))
        )
        
        const completedTasks = tasksSnapshot.docs.filter(doc => doc.data().status === 'completed').length
        const pendingTasks = tasksSnapshot.docs.filter(doc => doc.data().status === 'pending').length

        teamData.push({
          id: memberDoc.id,
          name: `${memberData.firstName} ${memberData.lastName}`,
          status,
          tasks: {
            completed: completedTasks,
            pending: pendingTasks
          }
        })

        if (status === 'present') presentCount++
        if (status === 'on-leave') onLeaveCount++
        totalPendingTasks += pendingTasks
        totalCompletedTasks += completedTasks
      }

      setStats({
        teamMembers: teamData.length,
        presentToday: presentCount,
        onLeave: onLeaveCount,
        pendingTasks: totalPendingTasks
      })

      setTeamMembers(teamData)

      // Update team performance data
      setTeamPerformance([
        { department: "Task Completion", value: totalCompletedTasks, color: "bg-blue-500" },
        { department: "Attendance Rate", value: Math.round((presentCount / teamData.length) * 100), color: "bg-teal-500" },
        { department: "Pending Tasks", value: totalPendingTasks, color: "bg-indigo-500" },
      ])

    } catch (error) {
      console.error('Error fetching manager data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <>
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Manager Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatsCard 
          title="Team Members" 
          value={stats.teamMembers} 
          valueColor="text-blue-600"
          icon={<Users className="h-6 w-6 text-blue-500" />}
          trend={stats.teamMembers > 0 ? "+2" : "No data"}
          trendColor={stats.teamMembers > 0 ? "text-green-500" : "text-gray-500"}
        />
        <StatsCard 
          title="Present Today" 
          value={stats.presentToday} 
          valueColor="text-green-600"
          icon={<CheckCircle className="h-6 w-6 text-green-500" />}
          trend={stats.presentToday > 0 ? `${Math.round((stats.presentToday / stats.teamMembers) * 100)}%` : "No data"}
          trendColor={stats.presentToday > 0 ? "text-green-500" : "text-gray-500"}
        />
        <StatsCard 
          title="On Leave" 
          value={stats.onLeave} 
          valueColor="text-orange-600"
          icon={<Calendar className="h-6 w-6 text-orange-500" />}
          trend={stats.onLeave > 0 ? `${Math.round((stats.onLeave / stats.teamMembers) * 100)}%` : "No data"}
          trendColor={stats.onLeave > 0 ? "text-orange-500" : "text-gray-500"}
        />
        <StatsCard 
          title="Pending Tasks" 
          value={stats.pendingTasks} 
          valueColor="text-red-600"
          icon={<Clock className="h-6 w-6 text-red-500" />}
          trend={stats.pendingTasks > 0 ? "-3" : "No data"}
          trendColor={stats.pendingTasks > 0 ? "text-red-500" : "text-gray-500"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <DepartmentChart 
              title="Team Performance" 
              data={teamPerformance} 
              maxValue={100} 
            />
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-800">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-4">
            <QuickActionCard
              title="Team Management"
              subtitle="View and manage team members"
              icon={<Users size={32} className="text-white" />}
              color="bg-gradient-to-r from-blue-500 to-blue-600"
              href="/team"
            />
            <QuickActionCard
              title="Schedule"
              subtitle="Manage team schedule"
              icon={<Calendar size={32} className="text-white" />}
              color="bg-gradient-to-r from-teal-500 to-teal-600"
              href="/schedule"
            />
            <QuickActionCard
              title="Performance"
              subtitle="Track team performance"
              icon={<BarChart size={32} className="text-white" />}
              color="bg-gradient-to-r from-indigo-500 to-indigo-600"
              href="/productivity"
            />
            <QuickActionCard
              title="Reports"
              subtitle="View team reports"
              icon={<FileText size={32} className="text-white" />}
              color="bg-gradient-to-r from-purple-500 to-purple-600"
              href="/documents"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Today's Attendance</h3>
          <div className="space-y-4">
            {teamMembers.map(member => (
              <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${
                    member.status === 'present' ? 'bg-green-500' :
                    member.status === 'on-leave' ? 'bg-orange-500' :
                    'bg-red-500'
                  }`} />
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-sm text-gray-500 capitalize">{member.status}</p>
                  </div>
                </div>
                <div className="text-sm">
                  <span className="text-green-500">{member.tasks.completed} completed</span>
                  <span className="mx-2">•</span>
                  <span className="text-orange-500">{member.tasks.pending} pending</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Task Status</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium">Completed</p>
                  <p className="text-sm text-gray-500">All time</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-green-500">
                {teamMembers.reduce((sum, member) => sum + member.tasks.completed, 0)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Clock className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="font-medium">In Progress</p>
                  <p className="text-sm text-gray-500">Currently working</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-orange-500">
                {teamMembers.reduce((sum, member) => sum + member.tasks.pending, 0)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
} 