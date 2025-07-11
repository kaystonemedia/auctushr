'use client'

import { useNewAuth } from '@/contexts/new-auth-context'
import AdminDashboard from '@/components/dashboard/admin-dashboard'
import ManagerDashboard from '@/components/dashboard/manager-dashboard'

export default function DashboardPage() {
  const { user } = useNewAuth()

  if (!user) {
    return null
  }

  switch (user.role) {
    case 'admin':
      return <AdminDashboard />
    case 'manager':
      return <ManagerDashboard />
    case 'employee':
      return <div>Employee Dashboard Coming Soon</div>
    default:
      return null
  }
} 