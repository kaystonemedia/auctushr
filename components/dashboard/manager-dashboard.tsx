'use client'

import { useState, useEffect } from 'react'
import { useNewAuth } from '@/contexts/new-auth-context'
import { StatsCard } from '@/components/ui/stats-card'
import { QuickActionCard } from '@/components/ui/quick-action-card'
import {
  Users,
  Calendar,
  BarChart3,
  CheckCircle,
  Clock,
  UserCheck,
  UserX,
  AlertCircle,
  Activity,
  Award,
} from 'lucide-react'
import { format } from 'date-fns'
import { Card } from '@/components/ui/card'
import { useRouter } from 'next/navigation'

const calculateTrend = (current: number, previous: number) => {
  if (previous === 0) return current > 0 ? '+100%' : '0%'
  const change = ((current - previous) / previous) * 100
  return `${change >= 0 ? '+' : ''}${Math.round(change)}%`
}

type TeamMember = {
  id: string
  name: string
  role: string
  status: string
  lastActive: Date
  productivityScore?: number
  email?: string
}

export default function ManagerDashboard() {
  const { user, isLoading: authLoading } = useNewAuth()
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
    activeProjects: 0,
    averageProductivityScore: 0,
    teamProductivityTrend: 0,
    topPerformers: 0,
  })
  const [previousStats, setPreviousStats] = useState({ ...stats })
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [recentActivity, setRecentActivity] = useState<
    Array<{ type: string; description: string; timestamp: Date; user: string }>
  >([])

  const loadDashboard = async () => {
    try {
      setLoading(true)
      setPreviousStats(stats)
      const res = await fetch('/api/dashboard/summary', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load dashboard')
      const data = await res.json()
      const s = data.stats
      setStats({
        teamSize: s.teamSize ?? s.totalEmployees ?? 0,
        presentToday: s.presentToday ?? 0,
        lateToday: s.lateToday ?? 0,
        absentToday: s.absentToday ?? 0,
        onLeaveToday: s.onLeaveToday ?? 0,
        pendingApprovals: s.pendingApprovals ?? 0,
        activeProjects: s.activeProjects ?? 0,
        averageProductivityScore: s.averageProductivityScore ?? 0,
        teamProductivityTrend: s.teamProductivityTrend ?? s.productivityTrend ?? 0,
        topPerformers: s.topPerformers ?? 0,
      })
      setTeamMembers(
        (data.teamMembers || []).map((m: TeamMember & { lastActive: string }) => ({
          ...m,
          lastActive: m.lastActive ? new Date(m.lastActive) : new Date(),
        }))
      )
      setRecentActivity(
        (data.recentActivity || []).map((item: { timestamp: string }) => ({
          ...item,
          timestamp: new Date(item.timestamp),
        }))
      )
    } catch (err) {
      console.error('Manager dashboard load error:', err)
      setError('Failed to load team dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/auth/sign-in')
      return
    }
    if (user.role !== 'manager' && user.role !== 'admin') {
      router.push('/dashboard')
      return
    }
    loadDashboard()
    const interval = setInterval(loadDashboard, 60_000)
    return () => clearInterval(interval)
  }, [user, authLoading, router])

  if (authLoading || loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
        <span className="ml-3">Loading dashboard...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="bg-red-50 p-4 rounded-lg">
          <h2 className="text-red-800 font-semibold">Error</h2>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  if (!user) return null

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
          trendColor={stats.teamSize >= previousStats.teamSize ? 'text-green-500' : 'text-red-500'}
          subtitle="Direct reports"
        />
        <StatsCard
          title="Present Today"
          value={stats.presentToday}
          valueColor="text-green-600"
          icon={<UserCheck className="h-6 w-6 text-green-500" />}
          trend={calculateTrend(stats.presentToday, previousStats.presentToday)}
          trendColor={stats.presentToday >= previousStats.presentToday ? 'text-green-500' : 'text-red-500'}
          subtitle={`${stats.teamSize > 0 ? Math.round((stats.presentToday / stats.teamSize) * 100) : 0}% of team`}
        />
        <StatsCard
          title="Late Today"
          value={stats.lateToday}
          valueColor="text-yellow-600"
          icon={<Clock className="h-6 w-6 text-yellow-500" />}
          trend={calculateTrend(stats.lateToday, previousStats.lateToday)}
          trendColor={stats.lateToday <= previousStats.lateToday ? 'text-green-500' : 'text-red-500'}
          subtitle={`${stats.teamSize > 0 ? Math.round((stats.lateToday / stats.teamSize) * 100) : 0}% of team`}
        />
        <StatsCard
          title="Absent Today"
          value={stats.absentToday}
          valueColor="text-red-600"
          icon={<UserX className="h-6 w-6 text-red-500" />}
          trend={calculateTrend(stats.absentToday, previousStats.absentToday)}
          trendColor={stats.absentToday <= previousStats.absentToday ? 'text-green-500' : 'text-red-500'}
          subtitle={`${stats.teamSize > 0 ? Math.round((stats.absentToday / stats.teamSize) * 100) : 0}% of team`}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatsCard
          title="Team Productivity"
          value={`${stats.averageProductivityScore}%`}
          valueColor="text-purple-600"
          icon={<Activity className="h-6 w-6 text-purple-500" />}
          trend={`${stats.teamProductivityTrend >= 0 ? '+' : ''}${stats.teamProductivityTrend}%`}
          trendColor={stats.teamProductivityTrend >= 0 ? 'text-green-500' : 'text-red-500'}
          subtitle="Average team score today"
        />
        <StatsCard
          title="Top Performers"
          value={stats.topPerformers}
          valueColor="text-emerald-600"
          icon={<Award className="h-6 w-6 text-emerald-500" />}
          subtitle="80%+ productivity today"
        />
        <StatsCard
          title="On Leave Today"
          value={stats.onLeaveToday}
          valueColor="text-purple-600"
          icon={<Calendar className="h-6 w-6 text-purple-500" />}
          trend={calculateTrend(stats.onLeaveToday, previousStats.onLeaveToday)}
          trendColor={stats.onLeaveToday <= previousStats.onLeaveToday ? 'text-green-500' : 'text-red-500'}
          subtitle={`${stats.teamSize > 0 ? Math.round((stats.onLeaveToday / stats.teamSize) * 100) : 0}% of team`}
        />
        <StatsCard
          title="Pending Approvals"
          value={stats.pendingApprovals}
          valueColor="text-orange-600"
          icon={<AlertCircle className="h-6 w-6 text-orange-500" />}
          trend={calculateTrend(stats.pendingApprovals, previousStats.pendingApprovals)}
          trendColor={stats.pendingApprovals <= previousStats.pendingApprovals ? 'text-green-500' : 'text-red-500'}
          subtitle="Leave requests"
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Productivity</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {teamMembers.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-4 text-sm text-gray-500">
                        No team members assigned yet.
                      </td>
                    </tr>
                  ) : (
                    teamMembers.map((member) => (
                      <tr key={member.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{member.name}</div>
                          <div className="text-sm text-gray-500">{member.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 capitalize">
                            {member.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{member.productivityScore ?? 0}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-gray-500">No recent activity.</p>
            ) : (
              recentActivity.map((item, i) => (
                <div key={i} className="text-sm border-b pb-2">
                  <p className="font-medium">{item.description}</p>
                  <p className="text-gray-500">{format(item.timestamp, 'MMM d, h:mm a')}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-4">
            <QuickActionCard
              title="Attendance"
              subtitle="View team attendance"
              icon={<BarChart3 size={24} className="text-white" />}
              color="bg-green-500"
              href="/attendance"
            />
            <QuickActionCard
              title="Leave Requests"
              subtitle={`${stats.pendingApprovals} pending`}
              icon={<CheckCircle size={24} className="text-white" />}
              color="bg-orange-500"
              href="/leave"
            />
            <QuickActionCard
              title="Productivity"
              subtitle="Monitor team productivity"
              icon={<Activity size={24} className="text-white" />}
              color="bg-purple-500"
              href="/productivity"
            />
            <QuickActionCard
              title="Tasks"
              subtitle={`${stats.activeProjects} active`}
              icon={<Users size={24} className="text-white" />}
              color="bg-blue-500"
              href="/tasks"
            />
          </div>
        </Card>
      </div>
    </>
  )
}
