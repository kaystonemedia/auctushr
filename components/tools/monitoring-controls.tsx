'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Play, Pause, Square, Loader2 } from 'lucide-react'
import { useElectronFeatures, isElectron } from '@/lib/electron-bridge'
import { toast } from '@/components/ui/use-toast'

interface MonitoringStatus {
  isMonitoring: boolean
  isPaused: boolean
  startTime?: string
  status?: string
}

export function MonitoringControls() {
  const { electronAPI, isElectron: isElectronEnv } = useElectronFeatures()
  const [status, setStatus] = useState<MonitoringStatus>({
    isMonitoring: false,
    isPaused: false,
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isElectronEnv || !electronAPI) return

    // Get initial status
    const loadStatus = async () => {
      try {
        if (!electronAPI?.getMonitoringStatus) {
          setLoading(false)
          return
        }
        const data = await electronAPI.getMonitoringStatus()
        if (data) {
          setStatus({
            isMonitoring: data.isMonitoring || false,
            isPaused: false, // Electron doesn't track paused state separately
            startTime: data.sessionStart,
            status: data.isActive ? 'active' : 'idle',
          })
        }
      } catch (error) {
        console.error('Failed to load monitoring status:', error)
        setLoading(false)
      } finally {
        setLoading(false)
      }
    }

    loadStatus().catch((error) => {
      console.error('Error in loadStatus:', error)
      setLoading(false)
    })

    // Listen for monitoring status changes
    const handleStatusChanged = (data: any) => {
      try {
        // Check if paused by looking at the data or status
        const isPaused = data?.status === 'paused' || (!data.isMonitoring && status.isPaused)
        setStatus({
          isMonitoring: data.isMonitoring || false,
          isPaused: isPaused,
          startTime: data.startTime || data.sessionStart || status.startTime,
          status: isPaused ? 'paused' : (data.status || (data.isActive ? 'active' : (data.isMonitoring ? 'monitoring' : 'stopped'))),
        })
        setLoading(false)
      } catch (error) {
        console.error('Error in handleStatusChanged:', error)
        setLoading(false)
      }
    }

    // Also listen for monitoring stopped (which includes paused state)
    const handleStopped = (data: any) => {
      try {
        if (data?.status === 'paused') {
          setStatus(prev => ({
            ...prev,
            isMonitoring: false,
            isPaused: true,
            status: 'paused',
          }))
          toast({
            title: "Monitoring Paused",
            description: "Activity tracking is temporarily paused",
          })
        } else {
          setStatus({
            isMonitoring: false,
            isPaused: false,
            startTime: undefined,
          })
          toast({
            title: "Monitoring Stopped",
            description: "Activity tracking has been stopped",
          })
        }
        setLoading(false)
      } catch (error) {
        console.error('Error in handleStopped:', error)
        setLoading(false)
      }
    }

    // Listen for monitoring started (including resume)
    const handleStarted = (data: any) => {
      try {
        setStatus(prev => ({
          ...prev,
          isMonitoring: true,
          isPaused: false,
          startTime: data?.startTime || prev.startTime || new Date().toISOString(),
          status: 'active',
        }))
        setLoading(false)
        toast({
          title: "Monitoring Started",
          description: "Activity tracking is now active",
        })
      } catch (error) {
        console.error('Error in handleStarted:', error)
        setLoading(false)
      }
    }

    // Only set up listeners if Electron API is available
    if (electronAPI) {
      try {
        electronAPI.onMonitoringStatusChanged?.(handleStatusChanged)
        electronAPI.onMonitoringStopped?.(handleStopped)
        electronAPI.onMonitoringStarted?.(handleStarted)
      } catch (error) {
        console.error('Error setting up Electron listeners:', error)
      }
    }

    // Refresh status periodically
    const interval = setInterval(() => {
      loadStatus().catch((error) => {
        console.error('Error in periodic loadStatus:', error)
      })
    }, 2000) // Every 2 seconds

    return () => {
      clearInterval(interval)
    }
  }, [isElectronEnv, electronAPI])

  const handleStart = () => {
    if (!electronAPI) return
    setLoading(true)
    try {
      electronAPI.startMonitoring?.()
      // This will either start monitoring or resume from paused state
    } catch (error) {
      console.error('Error starting monitoring:', error)
      setLoading(false)
      toast({
        title: "Error",
        description: "Failed to start monitoring",
        variant: "destructive",
      })
    }
  }

  const handlePause = () => {
    if (!electronAPI) return
    setLoading(true)
    try {
      electronAPI.pauseMonitoring?.()
      // Note: Electron pauseMonitoring sends 'monitoring-stopped' event with status: 'paused'
      // The status will be updated via the status change listener
    } catch (error) {
      console.error('Error pausing monitoring:', error)
      setLoading(false)
      toast({
        title: "Error",
        description: "Failed to pause monitoring",
        variant: "destructive",
      })
    }
  }

  const handleStop = () => {
    if (!electronAPI) return
    setLoading(true)
    try {
      electronAPI.stopMonitoring?.()
    } catch (error) {
      console.error('Error stopping monitoring:', error)
      setLoading(false)
      toast({
        title: "Error",
        description: "Failed to stop monitoring",
        variant: "destructive",
      })
    }
  }

  if (!isElectronEnv) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Monitoring Controls</CardTitle>
          <CardDescription>Desktop monitoring features</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>Desktop monitoring is only available in the Electron app.</p>
            <p className="text-sm mt-2">Please use the desktop application to access these features.</p>
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
            <CardTitle>Monitoring Controls</CardTitle>
            <CardDescription>Start, pause, or stop activity monitoring</CardDescription>
          </div>
          <Badge variant={status.isMonitoring ? "default" : "secondary"}>
            {status.isMonitoring ? (status.isPaused ? "Paused" : "Active") : "Inactive"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            onClick={handleStart}
            disabled={status.isMonitoring || loading}
            className="flex-1"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Start Monitoring
          </Button>
          {status.isPaused ? (
            <Button
              onClick={handleStart}
              disabled={loading}
              variant="outline"
              className="flex-1"
            >
              <Play className="w-4 h-4 mr-2" />
              Resume
            </Button>
          ) : (
            <Button
              onClick={handlePause}
              disabled={!status.isMonitoring || loading}
              variant="outline"
              className="flex-1"
            >
              <Pause className="w-4 h-4 mr-2" />
              Pause
            </Button>
          )}
          <Button
            onClick={handleStop}
            disabled={!status.isMonitoring || loading}
            variant="destructive"
            className="flex-1"
          >
            <Square className="w-4 h-4 mr-2" />
            Stop
          </Button>
        </div>

        {status.startTime && (
          <div className="pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Started: {new Date(status.startTime).toLocaleString()}
            </div>
            {status.status && (
              <div className="text-sm text-muted-foreground mt-1">
                Status: <span className="font-medium">{status.status}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

