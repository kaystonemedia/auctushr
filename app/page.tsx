'use client'

import { useAuth } from '@/contexts/auth-context'
import AdminDashboard from '@/components/dashboard/admin-dashboard'
import ManagerDashboard from '@/components/dashboard/manager-dashboard'

function DashboardContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  const renderDashboard = () => {
    switch (user?.role) {
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

  return renderDashboard()
}

export default function Home() {
  return (
    <DashboardContent />
  )
}


