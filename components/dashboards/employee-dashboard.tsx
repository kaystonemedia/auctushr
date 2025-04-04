"use client"

import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { StatsCard } from "@/components/stats-card"
import { QuickActionCard } from "@/components/quick-action-card"
import { Calendar, FileText, Clock, CheckCircle, User, Bell } from "lucide-react"

export default function EmployeeDashboard() {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activePath="/dashboard" />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto p-4">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-gray-700">My Dashboard</h1>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <StatsCard title="Hours Worked" value="32" valueColor="text-blue-500" />
              <StatsCard title="Leave Balance" value="12" valueColor="text-green-500" />
              <StatsCard title="Tasks Completed" value="8" valueColor="text-teal-500" />
              <StatsCard title="Pending Tasks" value="3" valueColor="text-orange-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="lg:col-span-2">
                <div className="bg-white p-6 rounded-lg border border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-700 mb-4">Today's Schedule</h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Clock className="h-5 w-5 text-blue-500" />
                        <div>
                          <p className="font-medium">Check-in</p>
                          <p className="text-sm text-gray-500">9:00 AM</p>
                        </div>
                      </div>
                      <span className="text-sm text-green-500">Completed</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <CheckCircle className="h-5 w-5 text-teal-500" />
                        <div>
                          <p className="font-medium">Team Meeting</p>
                          <p className="text-sm text-gray-500">10:30 AM</p>
                        </div>
                      </div>
                      <span className="text-sm text-orange-500">Upcoming</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Clock className="h-5 w-5 text-blue-500" />
                        <div>
                          <p className="font-medium">Check-out</p>
                          <p className="text-sm text-gray-500">6:00 PM</p>
                        </div>
                      </div>
                      <span className="text-sm text-gray-500">Pending</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-700">Quick Actions</h2>
                <div className="grid grid-cols-1 gap-4">
                  <QuickActionCard
                    title="My Profile"
                    subtitle="View and update your profile"
                    icon={<User size={32} className="text-white" />}
                    color="bg-blue-500"
                    href="/employee/profile"
                  />
                  <QuickActionCard
                    title="Leave Request"
                    subtitle="Submit a leave request"
                    icon={<Calendar size={32} className="text-white" />}
                    color="bg-teal-500"
                    href="/employee/leave"
                  />
                  <QuickActionCard
                    title="My Tasks"
                    subtitle="View and manage your tasks"
                    icon={<CheckCircle size={32} className="text-white" />}
                    color="bg-indigo-500"
                    href="/employee/tasks"
                  />
                  <QuickActionCard
                    title="Documents"
                    subtitle="Access your documents"
                    icon={<FileText size={32} className="text-white" />}
                    color="bg-orange-500"
                    href="/employee/documents"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <h3 className="font-medium mb-4">Recent Notifications</h3>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <Bell className="h-5 w-5 text-blue-500 mt-1" />
                    <div>
                      <p className="text-sm font-medium">New Task Assigned</p>
                      <p className="text-xs text-gray-500">2 hours ago</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Bell className="h-5 w-5 text-green-500 mt-1" />
                    <div>
                      <p className="text-sm font-medium">Leave Request Approved</p>
                      <p className="text-xs text-gray-500">1 day ago</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Bell className="h-5 w-5 text-orange-500 mt-1" />
                    <div>
                      <p className="text-sm font-medium">Upcoming Performance Review</p>
                      <p className="text-xs text-gray-500">2 days ago</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <h3 className="font-medium mb-4">Performance Summary</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Task Completion Rate</span>
                    <span className="text-sm font-medium text-green-500">85%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Attendance Rate</span>
                    <span className="text-sm font-medium text-blue-500">98%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Team Contribution</span>
                    <span className="text-sm font-medium text-teal-500">92%</span>
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