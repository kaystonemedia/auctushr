'use client'

import type { ComponentType } from 'react'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Target, Zap, Clock, Moon, BarChart3, Briefcase } from 'lucide-react'
import { useToolsSession } from '@/contexts/tools-session-context'
import { useElectronFeatures } from '@/lib/electron-bridge'
import { computeFocusLevel, formatDurationMs } from '@/lib/tools/format'

interface ElectronProductivity {
  productivityScore?: number
  focusLevel?: number
  activeTime?: number
  idleTime?: number
  sessionDuration?: number
}

export function PerformanceMetrics() {
  const { workSession, activity } = useToolsSession()
  const { electronAPI, isElectron: isElectronEnv } = useElectronFeatures()
  const [electronProd, setElectronProd] = useState<ElectronProductivity | null>(null)

  useEffect(() => {
    if (!isElectronEnv || !electronAPI?.getProductivityData) return
    let cancelled = false

    const load = async () => {
      try {
        const data = await electronAPI.getProductivityData?.()
        if (!cancelled && data && typeof data === 'object') {
          setElectronProd(data as ElectronProductivity)
        }
      } catch (error) {
        console.error('Failed to load productivity data:', error)
      }
    }

    load()
    const interval = setInterval(load, 10000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [isElectronEnv, electronAPI])

  const activeMs = Math.max(0, workSession.sessionDurationMs - workSession.idleDurationMs)
  const productivity = Math.max(0, Math.min(100, Math.round(electronProd?.productivityScore ?? activity.productivityScore ?? 0)))
  const focus = Math.max(
    0,
    Math.min(100, Math.round(electronProd?.focusLevel ?? computeFocusLevel(activeMs, workSession.sessionDurationMs)))
  )
  const clientMinutes = activity.clientWorkMinutes || 0

  const CircularMetric = ({
    value,
    label,
    icon: Icon,
    colorClass,
    subtitle,
  }: {
    value: string | number
    label: string
    icon: ComponentType<{ className?: string }>
    colorClass: string
    subtitle?: string
  }) => {
    const size = 120
    const strokeWidth = 8
    const radius = (size - strokeWidth) / 2
    const circumference = radius * 2 * Math.PI
    const numericValue = typeof value === 'number' ? value : 0
    const progress = numericValue / 100
    const strokeDashoffset = circumference - progress * circumference

    return (
      <div className="flex flex-col items-center">
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90 transform">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="currentColor"
              strokeWidth={strokeWidth}
              fill="none"
              className="text-muted"
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="currentColor"
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className={`${colorClass} transition-all duration-300`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Icon className={`mb-1 h-6 w-6 ${colorClass}`} />
            <div className={`text-2xl font-bold ${colorClass}`}>
              {typeof value === 'number' ? `${value}%` : value}
            </div>
          </div>
        </div>
        <div className="mt-2 text-center">
          <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
          {subtitle ? <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div> : null}
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Today&apos;s performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-6">
          <CircularMetric
            value={productivity}
            label="Productivity"
            icon={Target}
            colorClass="text-accent"
          />
          <CircularMetric
            value={focus}
            label="Focus level"
            icon={Zap}
            colorClass="text-primary"
          />
          <CircularMetric
            value={formatDurationMs(activeMs)}
            label="Active time"
            icon={Clock}
            colorClass="text-primary"
            subtitle="Time working"
          />
          <CircularMetric
            value={formatDurationMs(workSession.idleDurationMs)}
            label="Idle time"
            icon={Moon}
            colorClass="text-muted-foreground"
            subtitle="Time inactive"
          />
        </div>
        <div className="mt-4 flex items-center justify-center gap-2 rounded-md border bg-muted/30 p-2 text-sm text-muted-foreground">
          <Briefcase className="h-4 w-4" />
          Client work today: {clientMinutes} min
        </div>
      </CardContent>
    </Card>
  )
}
