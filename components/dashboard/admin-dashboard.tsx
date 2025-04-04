'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { db } from '@/lib/firebase'
import { collection, query, getDocs, where } from 'firebase/firestore'
import { StatsCard } from '@/components/ui/stats-card'
import { DepartmentChart } from '@/components/ui/department-chart'
import { QuickActionCard } from '@/components/ui/quick-action-card'
import { Users, Building2, BarChart3, Settings, BarChart, Clock, FileText } from 'lucide-react'

interface Department {
  id: string
  name: string
  employeeCount: number
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalEmployees: 0,
    departments: 0,
    activeProjects: 0,
    pendingApprovals: 0
  })
  const [departmentData, setDepartmentData] = useState([
    { department: "Engineering", value: 0, color: "bg-blue-500" },
    { department: "Marketing", value: 0, color: "bg-teal-500" },
    { department: "Sales", value: 0, color: "bg-indigo-500" },
    { department: "HR", value: 0, color: "bg-purple-500" },
  ])

  useEffect(() => {
    if (user) {
      fetchAdminData()
    }
  }, [user])

  const fetchAdminData = async () => {
    try {
      setLoading(true)
      
      // Fetch total employees
      const employeesSnapshot = await getDocs(collection(db, 'employees'))
      const totalEmployees = employeesSnapshot.size

      // Fetch departments
      const departmentsSnapshot = await getDocs(collection(db, 'departments'))
      const departments = departmentsSnapshot.size

      // Fetch active projects
      const projectsSnapshot = await getDocs(
        query(collection(db, 'projects'), where('status', '==', 'active'))
      )
      const activeProjects = projectsSnapshot.size

      // Fetch pending approvals
      const approvalsSnapshot = await getDocs(
        query(collection(db, 'approvals'), where('status', '==', 'pending'))
      )
      const pendingApprovals = approvalsSnapshot.size

      setStats({
        totalEmployees,
        departments,
        activeProjects,
        pendingApprovals
      })

      // Update department data with real values
      const departmentStats = await Promise.all(
        departmentsSnapshot.docs.map(async (doc) => {
          const deptData = doc.data()
          const employeesInDept = await getDocs(
            query(collection(db, 'employees'), where('departmentId', '==', doc.id))
          )
          return {
            department: deptData.name,
            value: employeesInDept.size,
            color: "bg-blue-500" // You can assign different colors based on department
          }
        })
      )

      setDepartmentData(departmentStats)

    } catch (error) {
      console.error('Error fetching admin data:', error)
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
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatsCard 
          title="Total Employees" 
          value={stats.totalEmployees} 
          valueColor="text-blue-600"
          icon={<Users className="h-6 w-6 text-blue-500" />}
          trend={stats.totalEmployees > 0 ? "+2" : "No data"}
          trendColor={stats.totalEmployees > 0 ? "text-green-500" : "text-gray-500"}
        />
        <StatsCard 
          title="Departments" 
          value={stats.departments} 
          valueColor="text-green-600"
          icon={<Building2 className="h-6 w-6 text-green-500" />}
          trend={stats.departments > 0 ? "+1" : "No data"}
          trendColor={stats.departments > 0 ? "text-green-500" : "text-gray-500"}
        />
        <StatsCard 
          title="Active Projects" 
          value={stats.activeProjects} 
          valueColor="text-orange-600"
          icon={<BarChart3 className="h-6 w-6 text-orange-500" />}
          trend={stats.activeProjects > 0 ? "+3" : "No data"}
          trendColor={stats.activeProjects > 0 ? "text-green-500" : "text-gray-500"}
        />
        <StatsCard 
          title="Pending Approvals" 
          value={stats.pendingApprovals} 
          valueColor="text-red-600"
          icon={<Clock className="h-6 w-6 text-red-500" />}
          trend={stats.pendingApprovals > 0 ? "-2" : "No data"}
          trendColor={stats.pendingApprovals > 0 ? "text-red-500" : "text-gray-500"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <DepartmentChart 
              title="Department Distribution" 
              data={departmentData} 
              maxValue={Math.max(...departmentData.map(d => d.value)) * 1.2} 
            />
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-800">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-4">
            <QuickActionCard
              title="Manage Employees"
              subtitle="View and manage employee records"
              icon={<Users size={32} className="text-white" />}
              color="bg-gradient-to-r from-blue-500 to-blue-600"
              href="/employees"
            />
            <QuickActionCard
              title="System Settings"
              subtitle="Configure system preferences"
              icon={<Settings size={32} className="text-white" />}
              color="bg-gradient-to-r from-teal-500 to-teal-600"
              href="/settings"
            />
            <QuickActionCard
              title="Reports"
              subtitle="View and generate reports"
              icon={<FileText size={32} className="text-white" />}
              color="bg-gradient-to-r from-indigo-500 to-indigo-600"
              href="/documents"
            />
            <QuickActionCard
              title="Analytics"
              subtitle="View system analytics"
              icon={<BarChart size={32} className="text-white" />}
              color="bg-gradient-to-r from-purple-500 to-purple-600"
              href="/productivity"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">System Health</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600">Server Load</span>
                <span className="text-sm font-medium text-gray-900">45%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '45%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600">Memory Usage</span>
                <span className="text-sm font-medium text-gray-900">62%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: '62%' }}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Storage Usage</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600">Total Storage</span>
                <span className="text-sm font-medium text-gray-900">1.2 TB</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-purple-500 h-2 rounded-full" style={{ width: '75%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600">Available Space</span>
                <span className="text-sm font-medium text-gray-900">300 GB</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-orange-500 h-2 rounded-full" style={{ width: '25%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
} 