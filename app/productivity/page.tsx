'use client'

import { useNewAuth } from '@/contexts/new-auth-context'
import { ProductivityDashboard } from '@/components/productivity/productivity-dashboard'

export default function ProductivityPage() {
  const { user } = useNewAuth()

  // Only allow admin and manager roles to access this page
  if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Access Denied</h1>
          <p className="mt-2 text-gray-600">You don't have permission to view this page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Productivity Analytics</h1>
          <p className="text-gray-500">Track and analyze employee productivity metrics.</p>
        </div>
      </div>

      <ProductivityDashboard />
    </div>
  )
} 