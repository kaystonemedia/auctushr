'use client'

import { useNewAuth } from '@/contexts/new-auth-context'
import { Loader2 } from 'lucide-react'
import { StatsCard } from '@/components/ui/stats-card'
import { QuickActionCard } from '@/components/ui/quick-action-card'
import { Users, Building2, BarChart3, Settings, FileText, Clock, Activity, Wallet, LineChart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'

export default function Dashboard() {
  const { user, isLoading } = useNewAuth()
  const [stats, setStats] = useState({
    totalEmployees: 0,
    departments: 0,
    activeProjects: 0,
    pendingApprovals: 0,
    teamSize: 0,
    presentToday: 0,
    onLeaveToday: 0,
    pendingTeamApprovals: 0,
    teamProjects: 0,
  })
  const [loadingStats, setLoadingStats] = useState(false)

  useEffect(() => {
    if (!user) return
    if (user.role === 'admin') {
      setLoadingStats(true)
      const fetchAdminStats = async () => {
        const usersSnap = await getDocs(collection(db, 'users'))
        const departments = new Set(usersSnap.docs.map(doc => doc.data().department))
        let activeProjects = 0
        try {
          const projectsSnap = await getDocs(query(collection(db, 'projects'), where('status', '==', 'active')))
          activeProjects = projectsSnap.size
        } catch {}
        const approvalsSnap = await getDocs(query(collection(db, 'leave_requests'), where('status', '==', 'pending')))
        setStats(s => ({
          ...s,
          totalEmployees: usersSnap.size,
          departments: departments.size,
          activeProjects,
          pendingApprovals: approvalsSnap.size,
        }))
        setLoadingStats(false)
      }
      fetchAdminStats()
    } else if (user.role === 'manager') {
      setLoadingStats(true)
      const fetchManagerStats = async () => {
        // Get team members
        const teamSnap = await getDocs(query(collection(db, 'users'), where('managerId', '==', user.id)))
        const teamIds = teamSnap.docs.map(doc => doc.id)
        // Attendance for today
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayEnd = new Date(today)
        todayEnd.setHours(23, 59, 59, 999)
        const attendanceSnap = await getDocs(query(
          collection(db, 'attendance'),
          where('userId', 'in', teamIds.length ? teamIds : ['dummy']) /* avoid empty 'in' */,
          where('date', '>=', today),
          where('date', '<=', todayEnd)
        ))
        // Pending approvals for team
        const approvalsSnap = await getDocs(query(
          collection(db, 'leave_requests'),
          where('status', '==', 'pending'),
          where('userId', 'in', teamIds.length ? teamIds : ['dummy'])
        ))
        // Active projects for team
        let teamProjects = 0
        try {
          const projectsSnap = await getDocs(query(
            collection(db, 'projects'),
            where('status', '==', 'active'),
            where('teamMembers', 'array-contains-any', teamIds.length ? teamIds : ['dummy'])
          ))
          teamProjects = projectsSnap.size
        } catch {}
        setStats(s => ({
          ...s,
          teamSize: teamSnap.size,
          presentToday: attendanceSnap.size, // You can refine this by status if needed
          pendingTeamApprovals: approvalsSnap.size,
          teamProjects,
        }))
        setLoadingStats(false)
      }
      fetchManagerStats()
    }
  }, [user])

  if (isLoading || loadingStats) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {user.role === 'admin' ? 'Admin' : 
             user.role === 'manager' ? 'Manager' : 'My'} Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">Welcome back, {user.name}</p>
        </div>
        {user.role === 'employee' && (
          <Button variant="outline" asChild>
            <Link href="/attendance">
              <Clock className="h-4 w-4 mr-2" />
              View Attendance
            </Link>
          </Button>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {user.role === 'admin' && (
          <>
            <QuickActionCard
              title="Employees"
              subtitle="Manage employees and departments"
              icon={<Users size={24} className="text-white" />}
              color="bg-blue-500"
              href="/employees"
            />
            <QuickActionCard
              title="Departments"
              subtitle="Manage company departments"
              icon={<Building2 size={24} className="text-white" />}
              color="bg-teal-500"
              href="/employees/departments"
            />
            <QuickActionCard
              title="Reports"
              subtitle="View company reports"
              icon={<BarChart3 size={24} className="text-white" />}
              color="bg-indigo-500"
              href="/reports"
            />
            <QuickActionCard
              title="Settings"
              subtitle="System settings"
              icon={<Settings size={24} className="text-white" />}
              color="bg-orange-500"
              href="/settings"
            />
          </>
        )}

        {user.role === 'manager' && (
          <>
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
          </>
        )}

        {user.role === 'employee' && (
          <>
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
          </>
        )}
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {user.role === 'admin' && (
          <>
            <StatsCard title="Total Employees" value={stats.totalEmployees} valueColor="text-blue-500" />
            <StatsCard title="Departments" value={stats.departments} valueColor="text-teal-500" />
            <StatsCard title="Active Projects" value={stats.activeProjects} valueColor="text-indigo-500" />
            <StatsCard title="Pending Approvals" value={stats.pendingApprovals} valueColor="text-orange-500" />
          </>
        )}

        {user.role === 'manager' && (
          <>
            <StatsCard title="Team Members" value={stats.teamSize} valueColor="text-blue-500" />
            <StatsCard title="Present Today" value={stats.presentToday} valueColor="text-green-500" />
            <StatsCard title="Pending Approvals" value={stats.pendingTeamApprovals} valueColor="text-orange-500" />
            <StatsCard title="Active Projects" value={stats.teamProjects} valueColor="text-purple-500" />
          </>
        )}

        {user.role === 'employee' && (
          <>
            <StatsCard title="Hours Worked" value="32" valueColor="text-blue-500" />
            <StatsCard title="Leave Balance" value="12" valueColor="text-green-500" />
            <StatsCard title="Tasks Completed" value="8" valueColor="text-teal-500" />
            <StatsCard title="Pending Tasks" value="3" valueColor="text-orange-500" />
          </>
        )}
      </div>
    </div>
  )
} 