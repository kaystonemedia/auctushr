'use client'

import { useNewAuth } from '@/contexts/new-auth-context'
import { Loader2, Users, Building2, BarChart3, Settings, FileText, Clock, Activity, Wallet, LineChart, TrendingUp, Award, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { payrollService } from '@/lib/payroll'
import { SettingsService } from '@/lib/settings'
import { ProductivityService } from '@/lib/productivity-service'

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
    averageProductivityScore: 0,
    totalPayrollThisMonth: 0,
    totalBonusesDistributed: 0,
    topPerformers: 0
  })
  const [loadingStats, setLoadingStats] = useState(false)

  useEffect(() => {
    if (user && !isLoading) {
      loadDashboardStats()
    }
  }, [user, isLoading])

  const loadDashboardStats = async () => {
    setLoadingStats(true)
    try {
      // Load basic stats
      const employeesSnapshot = await getDocs(collection(db, 'employees'))
      const totalEmployees = employeesSnapshot.size

      // Load attendance stats for today
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('date', '>=', today),
        where('date', '<', tomorrow)
      )
      const attendanceSnapshot = await getDocs(attendanceQuery)
      const attendanceRecords = attendanceSnapshot.docs.map(doc => doc.data())

      const presentToday = attendanceRecords.filter(record => record.status === 'present').length
      const onLeaveToday = attendanceRecords.filter(record => 
        record.status === 'early_leave' || record.status === 'half_day'
      ).length

      // Load productivity and payroll insights
      let averageProductivityScore = 0
      let totalPayrollThisMonth = 0
      let totalBonusesDistributed = 0
      let topPerformers = 0

      try {
        const payrollInsights = await payrollService.getPayrollInsights()
        averageProductivityScore = payrollInsights.averageProductivity
        totalPayrollThisMonth = payrollInsights.totalPayrollThisMonth
        totalBonusesDistributed = payrollInsights.totalBonusesDistributed

        // Calculate top performers (employees with 90%+ productivity)
        const settingsService = SettingsService.getInstance()
        const settings = await settingsService.getSettings()
        const defaultProductivitySettings = settingsService['defaultSettings']?.productivity || {}
        const loadedProductivitySettings = settings?.productivity || {}
        const mergedProductivitySettings = { ...defaultProductivitySettings, ...loadedProductivitySettings }
        console.log('Merged Productivity Settings:', mergedProductivitySettings)
        const productivityService = ProductivityService.getInstance(mergedProductivitySettings)
        const allEmployees = employeesSnapshot.docs.map(doc => doc.data())
        
        let topPerformersCount = 0
        for (const employee of allEmployees) {
          if (employee.uid) {
            try {
              const startDate = new Date()
              startDate.setDate(startDate.getDate() - 30) // Last 30 days
              const analytics = await productivityService.calculateProductivityAnalytics(
                employee.uid,
                startDate,
                new Date()
              )
              if (analytics.overview.averageProductivityScore >= 90) {
                topPerformersCount++
              }
            } catch (error) {
              console.warn(`Could not calculate productivity for employee ${employee.uid}:`, error)
            }
          }
        }
        topPerformers = topPerformersCount
      } catch (error) {
        console.warn('Could not load productivity/payroll insights:', error)
      }

      // Get projects data
      const projectsQuery = query(
        collection(db, 'projects'),
        where('status', '==', 'active')
      )
      const projectsSnapshot = await getDocs(projectsQuery)
      const activeProjects = projectsSnapshot.size

      // Get leave requests for pending approvals
      const leaveQuery = query(
        collection(db, 'leave_requests'),
        where('status', '==', 'pending')
      )
      const leaveSnapshot = await getDocs(leaveQuery)
      const pendingApprovals = leaveSnapshot.size

      // Load role-specific stats
      let teamSize = 0
      let pendingTeamApprovals = 0
      let teamProjects = 0

      if (user.role === 'manager') {
        // For managers, get their team stats
        const teamQuery = query(
          collection(db, 'employees'),
          where('managerId', '==', user.uid)
        )
        const teamSnapshot = await getDocs(teamQuery)
        teamSize = teamSnapshot.size

        // Get pending approvals for team
        const approvalsQuery = query(
          collection(db, 'leave_requests'),
          where('status', '==', 'pending')
        )
        const approvalsSnapshot = await getDocs(approvalsQuery)
        pendingTeamApprovals = approvalsSnapshot.size
      }

      setStats({
        totalEmployees,
        departments: new Set(employeesSnapshot.docs.map(doc => doc.data().department)).size,
        activeProjects,
        pendingApprovals,
        teamSize,
        presentToday,
        onLeaveToday,
        pendingTeamApprovals,
        teamProjects,
        averageProductivityScore,
        totalPayrollThisMonth,
        totalBonusesDistributed,
        topPerformers
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
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user.firstName || user.email}!
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
                </div>
                <Users className="h-8 w-8 text-blue-500" />
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
                  <p className="text-sm font-medium text-gray-600">Active Projects</p>
                  <p className="text-2xl font-bold text-indigo-600">{stats.activeProjects}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-indigo-500" />
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
                    {user.leaveBalance || 20}
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

      {/* New Cross-Module Insights Section */}
      {(user.role === 'admin' || user.role === 'manager') && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
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
                <p className="text-2xl font-bold text-emerald-600">{stats.topPerformers || 0}</p>
              </div>
              <Award className="h-8 w-8 text-emerald-500" />
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/employees" className="block">
          <div className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
            <div className="flex items-center space-x-3">
              <Users className="h-6 w-6 text-blue-500" />
              <div>
                <h3 className="font-medium text-gray-900">Employee Management</h3>
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
                <h3 className="font-medium text-gray-900">Attendance</h3>
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
                <h3 className="font-medium text-gray-900">Productivity</h3>
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
                <h3 className="font-medium text-gray-900">Payroll</h3>
                <p className="text-sm text-gray-500">Process payments</p>
              </div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
} 