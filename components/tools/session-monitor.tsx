'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Play, Pause, Coffee, Clock } from 'lucide-react'
import { useToolsSession } from '@/contexts/tools-session-context'
import { formatDurationHms, formatDurationMs } from '@/lib/tools/format'

export function SessionMonitor() {
  const { policy, workSession, workState, startWork, stopWork, toggleBreak } = useToolsSession()
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const effectiveBreakMs = useMemo(() => {
    let total = workSession.breakDurationMs
    if (workSession.isOnBreak && workSession.breakStart) {
      total += Date.now() - new Date(workSession.breakStart).getTime()
    }
    return total
  }, [workSession.breakDurationMs, workSession.breakStart, workSession.isOnBreak, currentTime])

  const breakLimitMs = policy.allowedBreakMinutes * 60 * 1000
  const breakRemainingMs = Math.max(0, breakLimitMs - effectiveBreakMs)
  const breakOverageMs = Math.max(0, effectiveBreakMs - breakLimitMs)

  const stateLabel = {
    inactive: 'Inactive',
    active: 'Active Work',
    idle: 'Idle',
    break: 'Break Mode',
    client_work: 'Client Work Mode',
  }[workState]

  const formatClock = (date: Date) => {
    let hours = date.getHours()
    const minutes = date.getMinutes()
    const seconds = date.getSeconds()
    const ampm = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12 || 12
    return `${hours} : ${String(minutes).padStart(2, '0')} : ${String(seconds).padStart(2, '0')} ${ampm}`
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Session Monitor</CardTitle>
        <Badge variant={workState === 'inactive' ? 'secondary' : 'default'} className="text-xs">
          {stateLabel}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center">
          <div className="text-5xl font-mono font-bold tracking-wider text-card-foreground">
            {formatClock(currentTime)}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Session:</span>
            <span className="text-sm font-mono font-semibold">
              {formatDurationHms(workSession.sessionDurationMs)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Break used:</span>
            <span className="text-sm font-mono font-semibold text-accent">
              {formatDurationMs(effectiveBreakMs)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Idle:</span>
            <span className="text-sm font-mono font-semibold text-muted-foreground">
              {formatDurationMs(workSession.idleDurationMs)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Break remaining:</span>
            <span className="text-sm font-mono font-semibold">{formatDurationMs(breakRemainingMs)}</span>
          </div>
          {breakOverageMs > 0 ? (
            <div className="text-xs text-destructive">Break overage: {formatDurationMs(breakOverageMs)}</div>
          ) : null}
          <div className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
            Session data saves automatically. Screen captures during work hours are stored for manager
            review only—you will not see them here.
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex gap-2">
            <Button onClick={startWork} disabled={workSession.isMonitoring} className="flex-1">
              <Play className="mr-2 h-4 w-4" />
              Start work
            </Button>
            <Button onClick={stopWork} disabled={!workSession.isMonitoring} variant="outline" className="flex-1">
              <Pause className="mr-2 h-4 w-4" />
              Stop work
            </Button>
          </div>
          <Button onClick={toggleBreak} variant="outline" className="w-full" disabled={!workSession.isMonitoring}>
            <Coffee className="mr-2 h-4 w-4" />
            {workSession.isOnBreak ? 'End break' : 'Start break'}
          </Button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Break allowance: {policy.allowedBreakMinutes} minutes
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
