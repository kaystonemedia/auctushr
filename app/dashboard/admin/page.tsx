'use client'

import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Building2, FileText, Settings, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function AdminDashboard() {
  const { user } = useAuth()

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          {/* <h1 className="text-3xl font-bold">Admin Dashboard</h1> */}
          <p className="text-sm text-gray-500 mt-1">Welcome back, {user?.name || 'Admin'}</p>
        </div>
        <div className="flex items-center space-x-4">
          <Button variant="outline" asChild>
            <Link href="/settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Link>
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                Manage all users in the system
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
            <CardTitle className="text-sm font-medium">Departments</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                Manage departments and teams
              </p>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/departments">
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                Manage system documents
              </p>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/documents">
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Settings</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                Configure system settings
              </p>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/settings">
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              No recent activity to show
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
                <Link href="/employees/new">
                  <Users className="h-4 w-4 mr-2" />
                  Add New Employee
                </Link>
              </Button>
              <Button variant="outline" className="h-auto py-4" asChild>
                <Link href="/departments/new">
                  <Building2 className="h-4 w-4 mr-2" />
                  Create Department
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 