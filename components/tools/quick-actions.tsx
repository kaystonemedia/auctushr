'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  LayoutDashboard,
  Timer,
  BarChart3,
  Settings,
  Camera,
  RefreshCw,
  FolderOpen,
  Download,
  Loader2,
} from 'lucide-react'
import { useElectronFeatures } from '@/lib/electron-bridge'
import { useRouter } from 'next/navigation'
import { useToolsSession } from '@/contexts/tools-session-context'
import { toast } from '@/components/ui/use-toast'

export function QuickActions() {
  const { electronAPI, isElectron: isElectronEnv } = useElectronFeatures()
  const router = useRouter()
  const { workSession } = useToolsSession()
  const [pending, setPending] = useState<string | null>(null)

  const handleDashboard = () => {
    router.push('/dashboard')
  }

  const handleTimer = () => {
    if (electronAPI?.showTimerOverlay) {
      electronAPI.showTimerOverlay()
      toast({ title: 'Timer overlay opened' })
    } else {
      toast({
        title: 'Desktop only',
        description: 'The floating timer overlay is only available in the Auctus desktop app.',
      })
    }
  }

  const handleScreenshot = async () => {
    if (pending) return
    setPending('screenshot')
    try {
      if (isElectronEnv && electronAPI?.takeScreenshotNow) {
        const result = await electronAPI.takeScreenshotNow()
        if (result?.success) {
          toast({
            title: 'Screenshot captured',
            description: result.filename || 'Saved to local screenshots folder',
          })
        } else {
          toast({
            title: 'Screenshot blocked',
            description: 'Privacy settings may be disabling captures.',
            variant: 'destructive',
          })
        }
      } else {
        toast({
          title: 'Desktop only',
          description: 'Manual screenshots require the Auctus desktop app.',
        })
      }
    } catch (error) {
      console.error('Screenshot failed:', error)
      toast({
        title: 'Screenshot failed',
        description: error instanceof Error ? error.message : 'Unable to capture screenshot',
        variant: 'destructive',
      })
    } finally {
      setPending(null)
    }
  }

  const handleSync = async () => {
    if (pending) return
    setPending('sync')
    try {
      if (isElectronEnv && electronAPI?.syncDataNow) {
        electronAPI.syncDataNow()
        toast({ title: 'Sync started', description: 'Desktop monitoring data is syncing in the background.' })
      } else {
        const res = await fetch('/api/tools/summary', { cache: 'no-store' })
        if (!res.ok) throw new Error('Sync failed')
        toast({ title: 'Sync complete', description: 'Tools workspace updated.' })
      }
      window.dispatchEvent(new Event('tools-summary-refresh'))
    } catch (error) {
      console.error('Sync failed:', error)
      toast({
        title: 'Sync failed',
        description: error instanceof Error ? error.message : 'Unable to refresh data',
        variant: 'destructive',
      })
    } finally {
      setPending(null)
    }
  }

  const handleOpenScreenshots = () => {
    if (isElectronEnv && electronAPI?.openScreenshotsFolder) {
      electronAPI.openScreenshotsFolder()
      toast({ title: 'Opening screenshots folder' })
    } else {
      const gallery = typeof document !== 'undefined' ? document.getElementById('tools-screenshot-gallery') : null
      if (gallery) {
        gallery.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else {
        toast({
          title: 'Folder unavailable',
          description: 'Use the desktop app to open the local screenshots folder.',
        })
      }
    }
  }

  const handleExport = async () => {
    if (pending) return
    setPending('export')
    try {
      if (isElectronEnv && electronAPI?.exportData) {
        electronAPI.exportData()
        toast({ title: 'Export started', description: 'Desktop export will save to your Downloads folder.' })
      } else {
        const blob = new Blob([JSON.stringify({ workSession, exportedAt: new Date().toISOString() }, null, 2)], {
          type: 'application/json',
        })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `auctus-tools-export-${new Date().toISOString().slice(0, 10)}.json`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        toast({ title: 'Export complete', description: 'Snapshot downloaded as JSON.' })
      }
    } catch (error) {
      console.error('Export failed:', error)
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Unable to export',
        variant: 'destructive',
      })
    } finally {
      setPending(null)
    }
  }

  const renderIcon = (key: string, Icon: typeof Camera) =>
    pending === key ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Quick Actions
          </CardTitle>
          <CardDescription className="mt-1">
            Trigger common workflows. Desktop-only actions are clearly labeled.
          </CardDescription>
        </div>
        <Badge variant={isElectronEnv ? 'default' : 'secondary'} className="text-xs">
          {isElectronEnv ? 'Desktop' : 'Web'}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          <Button
            onClick={handleDashboard}
            variant="outline"
            className="flex h-auto flex-col items-center gap-1 py-3"
          >
            <LayoutDashboard className="h-5 w-5" />
            <span className="text-xs">Dashboard</span>
          </Button>

          <Button
            onClick={handleScreenshot}
            variant="outline"
            className="flex h-auto flex-col items-center gap-1 py-3"
            disabled={!isElectronEnv || pending === 'screenshot'}
            title={isElectronEnv ? 'Capture a screenshot now' : 'Available in the desktop app'}
          >
            {renderIcon('screenshot', Camera)}
            <span className="text-xs">Screenshot</span>
          </Button>

          <Button
            onClick={handleSync}
            variant="outline"
            className="flex h-auto flex-col items-center gap-1 py-3"
            disabled={pending === 'sync'}
            title="Refresh metrics and push session data"
          >
            {renderIcon('sync', RefreshCw)}
            <span className="text-xs">Sync</span>
          </Button>

          <Button
            onClick={handleTimer}
            variant="outline"
            className="flex h-auto flex-col items-center gap-1 py-3"
            disabled={!isElectronEnv}
            title={isElectronEnv ? 'Open floating timer' : 'Available in the desktop app'}
          >
            <Timer className="h-5 w-5" />
            <span className="text-xs">Timer</span>
          </Button>

          <Button
            onClick={handleOpenScreenshots}
            variant="outline"
            className="flex h-auto flex-col items-center gap-1 py-3"
            title={isElectronEnv ? 'Open screenshots folder' : 'Jump to screenshot gallery'}
          >
            <FolderOpen className="h-5 w-5" />
            <span className="text-xs">{isElectronEnv ? 'Folder' : 'Gallery'}</span>
          </Button>

          <Button
            onClick={handleExport}
            variant="outline"
            className="flex h-auto flex-col items-center gap-1 py-3"
            disabled={pending === 'export'}
            title="Export session snapshot"
          >
            {renderIcon('export', isElectronEnv ? BarChart3 : Download)}
            <span className="text-xs">Export</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
