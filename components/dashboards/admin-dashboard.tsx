"use client"

import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { StatsCard } from "@/components/stats-card"
import { DepartmentChart } from "@/components/department-chart"
import { QuickActionCard } from "@/components/quick-action-card"
import { Lightbulb, HelpCircle, Users, Settings, FileText, BarChart } from "lucide-react"

export default function AdminDashboard() {
  const departmentData = [
    { department: "Finance", value: 7, color: "bg-blue-500" },
    { department: "HR", value: 4, color: "bg-teal-500" },
    { department: "IT", value: 5, color: "bg-indigo-500" },
    { department: "Marketing", value: 3, color: "bg-blue-500" },
    { department: "Design", value: 8, color: "bg-teal-500" },
    { department: "Management", value: 4, color: "bg-indigo-500" },
  ]

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activePath="/dashboard" />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto p-4">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-gray-700">Admin Dashboard</h1>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <StatsCard title="Total Employees" value="156" valueColor="text-blue-500" />
              <StatsCard title="Departments" value="6" valueColor="text-teal-500" />
              <StatsCard title="Active Projects" value="12" valueColor="text-indigo-500" />
              <StatsCard title="Pending Approvals" value="8" valueColor="text-orange-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="lg:col-span-2">
                <DepartmentChart title="Employees by department" data={departmentData} maxValue={10} />
              </div>

              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-700">Quick Actions</h2>
                <div className="grid grid-cols-1 gap-4">
                  <QuickActionCard
                    title="Manage Employees"
                    subtitle="Add, edit, or remove employees"
                    icon={<Users size={32} className="text-white" />}
                    color="bg-blue-500"
                    href="/admin/employees"
                  />
                  <QuickActionCard
                    title="System Settings"
                    subtitle="Configure system parameters"
                    icon={<Settings size={32} className="text-white" />}
                    color="bg-teal-500"
                    href="/admin/settings"
                  />
                  <QuickActionCard
                    title="Reports"
                    subtitle="View system reports"
                    icon={<FileText size={32} className="text-white" />}
                    color="bg-indigo-500"
                    href="/admin/reports"
                  />
                  <QuickActionCard
                    title="Analytics"
                    subtitle="View detailed analytics"
                    icon={<BarChart size={32} className="text-white" />}
                    color="bg-orange-500"
                    href="/admin/analytics"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <h3 className="font-medium mb-4">System Health</h3>
                <div className="text-3xl font-bold text-green-500 mb-2">98%</div>
                <div className="text-sm text-gray-500">All systems operational</div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <h3 className="font-medium mb-4">Storage Usage</h3>
                <div className="text-3xl font-bold text-blue-500 mb-2">45%</div>
                <div className="text-sm text-gray-500">234.5 GB of 500 GB used</div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
} 