'use client'

import { useNewAuth } from '@/contexts/new-auth-context'
import { Loader2, Users, Building2, BarChart3, Settings, FileText, Clock, Activity, Wallet, LineChart, TrendingUp, Award, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { DesktopAppPopup } from '@/components/desktop-app-popup'

export default function Dashboard() {
  const { user, isLoading } = useNewAuth()
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeThisMonth: 0,
    attendanceRate: 0,
    departments: 0,
    activeProjects: 0,
    pendingApprovals: 0,
    teamSize: 0,
    presentToday: 0,
    onLeaveToday: 0,
    pendingTeamApprovals: 0,
    teamProjects: 0,
    averageProductivityScore: 0,
    totalPayrollThisMonth: 0,
    totalBonusesDistributed: 0,
    topPerformers: 0
  })
  const [loadingStats, setLoadingStats] = useState(false)
  const [showDesktopPopup, setShowDesktopPopup] = useState(false)

  useEffect(() => {
    if (user && !isLoading) {
      loadDashboardStats()
      
      // Show desktop app popup after successful login (only once per session)
      const hasShownPopup = sessionStorage.getItem('desktopPopupShown')
      if (!hasShownPopup) {
        // Delay popup to let dashboard load first
        setTimeout(() => {
          setShowDesktopPopup(true)
          sessionStorage.setItem('desktopPopupShown', 'true')
        }, 2000)
      }
    }
  }, [user, isLoading])

  const loadDashboardStats = async () => {
    setLoadingStats(true)
    try {
      const [dashboardRes, payrollRes] = await Promise.all([
        fetch('/api/dashboard/summary', { credentials: 'include' }),
        fetch('/api/payroll/insights', { credentials: 'include' }),
      ])

      if (!dashboardRes.ok) throw new Error('Failed to load dashboard summary')
      const dashboardData = await dashboardRes.json()
      const payrollData = payrollRes.ok ? await payrollRes.json() : {}
      const s = dashboardData.stats || {}

      const totalEmployees = Number(s.totalEmployees || s.teamSize || 0)
      const presentToday = Number(s.presentToday || 0)
      const activeThisMonth = totalEmployees
      const attendanceRate =
        totalEmployees > 0 ? Math.round((presentToday / totalEmployees) * 100) : 0

      setStats({
        totalEmployees,
        activeThisMonth,
        attendanceRate,
        departments: Number(s.departments || 0),
        activeProjects: Number(s.activeProjects || 0),
        pendingApprovals: Number(s.pendingApprovals || 0),
        teamSize: Number(s.teamSize || s.totalEmployees || 0),
        presentToday,
        onLeaveToday: Number(s.onLeaveToday || 0),
        pendingTeamApprovals: Number(s.pendingApprovals || 0),
        teamProjects: Number(s.activeProjects || 0),
        averageProductivityScore: Number(
          payrollData.averageProductivity || s.averageProductivityScore || 0
        ),
        totalPayrollThisMonth: Number(payrollData.totalPayrollThisMonth || 0),
        totalBonusesDistributed: Number(payrollData.totalBonusesDistributed || 0),
        topPerformers: Number(s.topPerformers || 0),
      })
    } catch (error) {
      console.error('Error loading dashboard stats:', error)
    } finally {
      setLoadingStats(false)
    }
  }

  if (isLoading || loadingStats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Please sign in to access the dashboard</h1>
          <Link href="/auth/sign-in">
            <Button>Sign In</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-corporate-navy">
          Welcome back, {user.name || user.email}!
        </h1>
        <p className="text-gray-600 mt-2">
          Here's what's happening in your organization today.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {user.role === 'admin' && (
          <>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Employees</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.totalEmployees}</p>
                  <p className="text-xs text-gray-500 mt-1">{stats.activeThisMonth} active this month</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Attendance Rate</p>
                  <p className="text-2xl font-bold text-green-600">{stats.attendanceRate}%</p>
                  <p className="text-xs text-gray-500 mt-1">Last 30 days</p>
                </div>
                <Clock className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Departments</p>
                  <p className="text-2xl font-bold text-teal-600">{stats.departments}</p>
                </div>
                <Building2 className="h-8 w-8 text-teal-500" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Approvals</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.pendingApprovals}</p>
                </div>
                <Settings className="h-8 w-8 text-orange-500" />
              </div>
            </div>
          </>
        )}

        {user.role === 'manager' && (
          <>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Team Members</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.teamSize}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Present Today</p>
                  <p className="text-2xl font-bold text-green-600">{stats.presentToday}</p>
                </div>
                <Clock className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Approvals</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.pendingTeamApprovals}</p>
                </div>
                <Settings className="h-8 w-8 text-orange-500" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Projects</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.teamProjects}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-purple-500" />
              </div>
            </div>
          </>
        )}

        {user.role === 'employee' && (
          <>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Hours Worked</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {stats.presentToday > 0 ? Math.round(stats.presentToday * 8) : 0}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-blue-500" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Leave Balance</p>
                  <p className="text-2xl font-bold text-green-600">
                    20
                  </p>
                </div>
                <FileText className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Tasks Completed</p>
                  <p className="text-2xl font-bold text-teal-600">
                    {stats.topPerformers > 0 ? Math.round(stats.topPerformers / 2) : 0}
                  </p>
                </div>
                <Activity className="h-8 w-8 text-teal-500" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Tasks</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {stats.pendingApprovals > 0 ? Math.round(stats.pendingApprovals / 3) : 0}
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-orange-500" />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Role-based stats */}
      {(user.role === 'admin' || user.role === 'manager') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Productivity</p>
                <p className="text-2xl font-bold text-purple-600">
                  {isNaN(stats.averageProductivityScore) ? '0.0' : stats.averageProductivityScore.toFixed(1)}%
                </p>
              </div>
              <Activity className="h-8 w-8 text-purple-500" />
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Top Performers</p>
                <p className="text-2xl font-bold text-emerald-mint">{stats.topPerformers || 0}</p>
              </div>
              <Award className="h-8 w-8 text-emerald-mint" />
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Monthly Payroll</p>
                <p className="text-2xl font-bold text-indigo-600">
                  ${stats.totalPayrollThisMonth > 0 ? (stats.totalPayrollThisMonth / 1000).toFixed(1) : '0.0'}k
                </p>
              </div>
              <Wallet className="h-8 w-8 text-indigo-500" />
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Performance Bonuses</p>
                <p className="text-2xl font-bold text-green-600">
                  ${stats.totalBonusesDistributed > 0 ? (stats.totalBonusesDistributed / 1000).toFixed(1) : '0.0'}k
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Link href="/employees" className="block">
          <div className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
            <div className="flex items-center space-x-3">
              <Users className="h-6 w-6 text-blue-500" />
              <div>
                <h3 className="font-medium text-corporate-navy">Employee Management</h3>
                <p className="text-sm text-gray-500">Manage your team</p>
              </div>
            </div>
          </div>
        </Link>
        
        <Link href="/attendance" className="block">
          <div className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
            <div className="flex items-center space-x-3">
              <Clock className="h-6 w-6 text-green-500" />
              <div>
                <h3 className="font-medium text-corporate-navy">Attendance</h3>
                <p className="text-sm text-gray-500">Track attendance</p>
              </div>
            </div>
          </div>
        </Link>
        
        <Link href="/productivity" className="block">
          <div className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
            <div className="flex items-center space-x-3">
              <Activity className="h-6 w-6 text-purple-500" />
              <div>
                <h3 className="font-medium text-corporate-navy">Productivity</h3>
                <p className="text-sm text-gray-500">Monitor performance</p>
              </div>
            </div>
          </div>
        </Link>
        
        <Link href="/payroll" className="block">
          <div className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
            <div className="flex items-center space-x-3">
              <Wallet className="h-6 w-6 text-orange-500" />
              <div>
                <h3 className="font-medium text-corporate-navy">Payroll</h3>
                <p className="text-sm text-gray-500">Process payments</p>
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Desktop App Popup */}
      <DesktopAppPopup 
        isOpen={showDesktopPopup} 
        onClose={() => setShowDesktopPopup(false)} 
      />
    </div>
  )
} 