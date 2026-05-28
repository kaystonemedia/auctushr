'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText } from 'lucide-react'
import { useToolsSession } from '@/contexts/tools-session-context'

export function TaskOverview() {
  const { taskStats } = useToolsSession()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Task overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3">
            <span className="text-sm font-medium text-muted-foreground uppercase">Received</span>
            <span className="text-lg font-bold text-primary">{taskStats.received}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3">
            <span className="text-sm font-medium text-muted-foreground uppercase">Pending</span>
            <span className="text-lg font-bold text-accent">{taskStats.pending}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3">
            <span className="text-sm font-medium text-muted-foreground uppercase">Completed</span>
            <span className="text-lg font-bold text-primary">{taskStats.completed}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
