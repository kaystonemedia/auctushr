'use client'

import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Calendar, FileText, BarChart, ArrowRight, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function ManagerDashboard() {
  const { user } = useAuth()

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Manager Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Welcome back, {user?.name || 'Manager'}</p>
        </div>
        <div className="flex items-center space-x-4">
          <Button variant="outline" asChild>
            <Link href="/attendance">
              <Calendar className="h-4 w-4 mr-2" />
              View Attendance
            </Link>
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                View and manage your team
              </p>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/employees">
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leave Requests</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                Review leave requests
              </p>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/leave-management">
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reports</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                View team reports
              </p>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/reports">
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                Track team performance
              </p>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/productivity">
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              No pending approvals
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <Button variant="outline" className="h-auto py-4" asChild>
                <Link href="/leave-management/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Approve Leave
                </Link>
              </Button>
              <Button variant="outline" className="h-auto py-4" asChild>
                <Link href="/reports/new">
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Report
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 