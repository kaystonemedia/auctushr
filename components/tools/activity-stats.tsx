'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Activity, Clock, Monitor, TrendingUp, ListChecks } from 'lucide-react'
import { useToolsSession } from '@/contexts/tools-session-context'
import { formatDurationMs } from '@/lib/tools/format'

export function ActivityStats() {
  const { activity, workSession } = useToolsSession()

  const totalMs = activity.totalTimeMs || workSession.sessionDurationMs || 1
  const activePercent = Math.min(100, Math.round((activity.activeTimeMs / totalMs) * 100))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Activity stats
        </CardTitle>
        <CardDescription>Live session metrics for today</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-muted-foreground">Active vs session</span>
            <span className="font-medium">{activePercent}%</span>
          </div>
          <Progress value={activePercent} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border p-3">
            <Clock className="mb-1 h-4 w-4 text-primary" />
            <div className="text-xs text-muted-foreground">Active</div>
            <div className="font-mono text-sm font-semibold">{formatDurationMs(activity.activeTimeMs)}</div>
          </div>
          <div className="rounded-lg border p-3">
            <Monitor className="mb-1 h-4 w-4 text-muted-foreground" />
            <div className="text-xs text-muted-foreground">Idle</div>
            <div className="font-mono text-sm font-semibold">{formatDurationMs(activity.idleTimeMs)}</div>
          </div>
          <div className="rounded-lg border p-3">
            <ListChecks className="mb-1 h-4 w-4 text-accent" />
            <div className="text-xs text-muted-foreground">Activity events</div>
            <div className="font-mono text-sm font-semibold">{activity.activitiesCount}</div>
          </div>
          <div className="rounded-lg border p-3">
            <TrendingUp className="mb-1 h-4 w-4 text-primary" />
            <div className="text-xs text-muted-foreground">Score</div>
            <div className="font-mono text-sm font-semibold">{activity.productivityScore}%</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
