'use client'

import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { StatsCard } from "@/components/stats-card"
import { DepartmentChart } from "@/components/department-chart"
import { QuickActionCard } from "@/components/quick-action-card"
import { Users, Calendar, FileText, BarChart, CheckCircle, Clock } from "lucide-react"

export default function ManagerDashboard() {
  const departmentData = [
    { department: "Team A", value: 5, color: "bg-blue-500" },
    { department: "Team B", value: 4, color: "bg-teal-500" },
    { department: "Team C", value: 3, color: "bg-indigo-500" },
  ]

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activePath="/dashboard" />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto p-4">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-gray-700">Manager Dashboard</h1>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <StatsCard title="Team Members" value="12" valueColor="text-blue-500" />
              <StatsCard title="Present Today" value="10" valueColor="text-green-500" />
              <StatsCard title="On Leave" value="2" valueColor="text-orange-500" />
              <StatsCard title="Pending Tasks" value="5" valueColor="text-red-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="lg:col-span-2">
                <DepartmentChart title="Team Performance" data={departmentData} maxValue={10} />
              </div>

              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-700">Quick Actions</h2>
                <div className="grid grid-cols-1 gap-4">
                  <QuickActionCard
                    title="Team Management"
                    subtitle="View and manage team members"
                    icon={<Users size={32} className="text-white" />}
                    color="bg-blue-500"
                    href="/manager/team"
                  />
                  <QuickActionCard
                    title="Schedule"
                    subtitle="Manage team schedule"
                    icon={<Calendar size={32} className="text-white" />}
                    color="bg-teal-500"
                    href="/manager/schedule"
                  />
                  <QuickActionCard
                    title="Performance"
                    subtitle="Track team performance"
                    icon={<BarChart size={32} className="text-white" />}
                    color="bg-indigo-500"
                    href="/manager/performance"
                  />
                  <QuickActionCard
                    title="Reports"
                    subtitle="View team reports"
                    icon={<FileText size={32} className="text-white" />}
                    color="bg-orange-500"
                    href="/manager/reports"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <h3 className="font-medium mb-4">Today's Attendance</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Present</span>
                    <span className="text-sm font-medium text-green-500">10</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Late</span>
                    <span className="text-sm font-medium text-orange-500">1</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Absent</span>
                    <span className="text-sm font-medium text-red-500">1</span>
                  </div>
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <h3 className="font-medium mb-4">Task Status</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Completed</span>
                    <span className="text-sm font-medium text-green-500">8</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">In Progress</span>
                    <span className="text-sm font-medium text-blue-500">3</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Pending</span>
                    <span className="text-sm font-medium text-orange-500">2</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
} 