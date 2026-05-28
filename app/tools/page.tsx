'use client'

import { Monitor } from 'lucide-react'
import { ToolsSessionProvider } from '@/contexts/tools-session-context'
import { SessionMonitor } from '@/components/tools/session-monitor'
import { TaskOverview } from '@/components/tools/task-overview'
import { QuickActions } from '@/components/tools/quick-actions'
import { PerformanceMetrics } from '@/components/tools/performance-metrics'
import { NotificationsPanel } from '@/components/tools/notifications-panel'
import { ClientWorkTracker } from '@/components/tools/client-work-tracker'
import { ActivityStats } from '@/components/tools/activity-stats'
import { MonitoringControls } from '@/components/tools/monitoring-controls'
import { ScreenshotGallery } from '@/components/tools/screenshot-gallery'
import { AuthStatus } from '@/components/tools/auth-status'
import { SystemMetrics } from '@/components/tools/system-metrics'

function ToolsPageContent() {
  return (
    <div className="space-y-8">
      <div className="rounded-2xl border bg-gradient-to-r from-primary/10 via-accent/10 to-primary/5 p-6">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-card-foreground">
          <Monitor className="h-8 w-8 text-primary" />
          Tools
        </h1>
        <p className="mt-2 text-muted-foreground">
          Work intelligence workspace — session, breaks, client work, and productivity in one place.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-5">
          <AuthStatus />
          <SessionMonitor />
          <MonitoringControls />
          <QuickActions />
          <NotificationsPanel />
        </div>
        <div className="space-y-6 xl:col-span-7">
          <div className="grid gap-6 lg:grid-cols-2">
            <TaskOverview />
            <ActivityStats />
          </div>
          <PerformanceMetrics />
          <SystemMetrics />
          <ClientWorkTracker />
          <ScreenshotGallery />
        </div>
      </div>
    </div>
  )
}

export default function ToolsPage() {
  return (
    <ToolsSessionProvider>
      <ToolsPageContent />
    </ToolsSessionProvider>
  )
}
