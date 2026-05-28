'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Cpu, HardDrive, Activity, Layers, Monitor as MonitorIcon } from 'lucide-react'
import { useElectronFeatures, type SystemInfo } from '@/lib/electron-bridge'
import { formatDurationMs } from '@/lib/tools/format'

const formatBytes = (bytes: number) => {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i += 1
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[i]}`
}

export function SystemMetrics() {
  const { electronAPI, isElectron: isElectronEnv } = useElectronFeatures()
  const [info, setInfo] = useState<SystemInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isElectronEnv || !electronAPI?.getSystemInfo) return

    let cancelled = false

    const load = async () => {
      try {
        const data = await electronAPI.getSystemInfo?.()
        if (!cancelled && data) {
          setInfo(data)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load system info:', err)
          setError('Unable to read system metrics')
        }
      }
    }

    load()
    const interval = setInterval(load, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [isElectronEnv, electronAPI])

  if (!isElectronEnv) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            System Metrics
          </CardTitle>
          <CardDescription>Desktop-only diagnostics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            Install the Auctus desktop app to view platform, runtime and memory metrics here.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              System Metrics
            </CardTitle>
            <CardDescription>Live desktop diagnostics</CardDescription>
          </div>
          {info ? (
            <Badge variant={info.isMonitoring ? 'default' : 'secondary'}>
              {info.isMonitoring ? 'Monitoring' : 'Idle'}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : !info ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Reading metrics…</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
                <Layers className="h-3.5 w-3.5" />
                Platform
              </div>
              <div className="mt-1 text-sm font-semibold capitalize">
                {info.platform} ({info.arch})
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                App v{info.appVersion} • Electron {info.electronVersion || 'n/a'}
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
                <HardDrive className="h-3.5 w-3.5" />
                Memory (RSS)
              </div>
              <div className="mt-1 text-sm font-semibold">{formatBytes(info.memory.rssBytes)}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Heap {formatBytes(info.memory.heapUsedBytes)} / {formatBytes(info.memory.heapTotalBytes)}
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
                <Activity className="h-3.5 w-3.5" />
                Session uptime
              </div>
              <div className="mt-1 text-sm font-semibold">{formatDurationMs(info.sessionDurationMs)}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Idle {formatDurationMs(info.idleTimeMs)}
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
                <MonitorIcon className="h-3.5 w-3.5" />
                Captures
              </div>
              <div className="mt-1 text-sm font-semibold">{info.screenshotsCount} screenshots</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {info.activitiesCount} activity events
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
