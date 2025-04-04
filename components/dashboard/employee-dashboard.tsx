'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AnalyticsDashboard } from '@/components/attendance/analytics-dashboard'
import { ShiftScheduler } from '@/components/attendance/shift-schedule'
import { BreakTimer } from '@/components/attendance/break-timer'
import { User, Clock, BarChart3 } from 'lucide-react'

export function EmployeeDashboard() {
  const { user } = useAuth()

  if (!user) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">My Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-6">
          <h2 className="text-lg font-medium mb-4">Quick Actions</h2>
          <BreakTimer />
        </Card>
        
        <Card className="p-6">
          <h2 className="text-lg font-medium mb-4">Current Shift</h2>
          <ShiftScheduler employeeId={user.uid} />
        </Card>
      </div>

      <Tabs defaultValue="attendance" className="space-y-6">
        <TabsList>
          <TabsTrigger value="attendance" className="flex items-center">
            <Clock className="w-4 h-4 mr-2" />
            My Attendance
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center">
            <BarChart3 className="w-4 h-4 mr-2" />
            Personal Analytics
          </TabsTrigger>
          <TabsTrigger value="profile" className="flex items-center">
            <User className="w-4 h-4 mr-2" />
            Profile
          </TabsTrigger>
        </TabsList>

        <TabsContent value="attendance">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Attendance History</h2>
            {/* Add attendance history component here */}
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsDashboard viewMode="personal" employeeId={user.uid} />
        </TabsContent>

        <TabsContent value="profile">
          <Card className="p-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Name</h3>
                <p className="text-lg">{user.name}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Email</h3>
                <p className="text-lg">{user.email}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Department</h3>
                <p className="text-lg">{user.department}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Role</h3>
                <p className="text-lg capitalize">{user.role}</p>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
} 