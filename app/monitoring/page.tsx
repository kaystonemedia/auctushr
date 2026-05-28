'use client'

import { useNewAuth } from '@/contexts/new-auth-context'
import { ManagerMonitoringDashboard } from '@/components/monitoring/manager-monitoring-dashboard'

export default function MonitoringPage() {
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
          <h1 className="text-2xl font-semibold text-gray-900">Employee Monitoring</h1>
          <p className="text-gray-500">
            Manager view of synced desktop activity (read-only reports). For the employee desktop tracker
            (time + screenshots), run the app with{' '}
            <code className="text-sm bg-muted px-1 rounded">npm run electron:desktop-monitor</code>.
          </p>
        </div>
      </div>

      <ManagerMonitoringDashboard />
    </div>
  )
}