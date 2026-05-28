'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Monitor, Eye, EyeOff, FolderOpen } from 'lucide-react'
import { useElectronFeatures, isElectron } from '@/lib/electron-bridge'
import { toast } from '@/components/ui/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Screenshot {
  id: string
  timestamp: string
  dataUrl?: string
  filename?: string
  filePath?: string
  privacyLevel?: string
  activeWindow?: string
  workStatus?: string
}

export function ScreenshotGallery() {
  const { electronAPI, isElectron: isElectronEnv } = useElectronFeatures()
  const [screenshots, setScreenshots] = useState<Screenshot[]>([])
  const [selectedScreenshot, setSelectedScreenshot] = useState<Screenshot | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isElectronEnv || !electronAPI) {
      const loadWebScreenshots = async () => {
        try {
          const res = await fetch('/api/monitoring/sync?limit=24')
          if (!res.ok) return
          const json = await res.json()
          const items = (json.data?.screenshots || []) as Array<Record<string, unknown>>
          setScreenshots(
            items.map((item) => ({
              id: String(item.id || `screenshot_${item.timestamp}`),
              timestamp: String(item.timestamp || new Date().toISOString()),
              dataUrl: item.dataUrl as string | undefined,
              filename: item.filename as string | undefined,
              privacyLevel: item.privacyLevel as string | undefined,
              activeWindow: item.activeWindow as string | undefined,
              workStatus: item.workStatus as string | undefined,
            }))
          )
        } catch (error) {
          console.error('Failed to load web screenshots:', error)
        } finally {
          setLoading(false)
        }
      }

      loadWebScreenshots()
      const interval = setInterval(loadWebScreenshots, 30000)
      return () => clearInterval(interval)
    }

    // Load screenshots count from monitoring status
    // Note: Screenshots are primarily received via onScreenshotTaken events
    // The Electron main process sends screenshots as they're captured
    const loadScreenshots = async () => {
      try {
        if (!electronAPI?.getMonitoringStatus) {
          setLoading(false)
          return
        }
        const status = await electronAPI.getMonitoringStatus()
        if (status && status.screenshotsCount !== undefined) {
          // Update count if we have fewer screenshots than reported
          // This handles the case where screenshots were captured before page load
          if (screenshots.length < status.screenshotsCount) {
            // Screenshots will be loaded via events when page refreshes or new ones are taken
            // For now, we just track the count
          }
        }
      } catch (error) {
        console.error('Failed to load screenshots:', error)
      } finally {
        setLoading(false)
      }
    }

    loadScreenshots().catch((error) => {
      console.error('Error in loadScreenshots:', error)
      setLoading(false)
    })

    // Listen for new screenshots (this is the primary way to get screenshot data)
    const handleScreenshotTaken = (screenshot: any) => {
      try {
        // Electron sends the full screenshot object with dataUrl, timestamp, etc.
        const screenshotData: Screenshot = {
          id: screenshot?.id || `screenshot_${Date.now()}`,
          timestamp: screenshot?.timestamp || new Date().toISOString(),
          dataUrl: screenshot?.dataUrl,
          filename: screenshot?.filename,
          filePath: screenshot?.filePath,
          privacyLevel: screenshot?.privacyLevel,
          activeWindow: screenshot?.activeWindow,
          workStatus: screenshot?.workStatus,
        }
        setScreenshots(prev => [screenshotData, ...prev].slice(0, 50)) // Keep last 50
        toast({
          title: "Screenshot Captured",
          description: screenshot?.filename || "New screenshot added to gallery",
        })
      } catch (error) {
        console.error('Error in handleScreenshotTaken:', error)
      }
    }

    // Only set up listener if Electron API is available
    if (electronAPI) {
      try {
        electronAPI.onScreenshotTaken?.(handleScreenshotTaken)
      } catch (error) {
        console.error('Error setting up screenshot listener:', error)
      }
    }

  }, [isElectronEnv, electronAPI])

  const handleOpenFolder = () => {
    if (!electronAPI) return
    try {
      electronAPI.openScreenshotsFolder?.()
      toast({
        title: "Opening Folder",
        description: "Screenshots folder will open shortly",
      })
    } catch (error) {
      console.error('Error opening folder:', error)
      toast({
        title: "Error",
        description: "Failed to open screenshots folder",
        variant: "destructive",
      })
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString()
  }

  return (
    <Card id="tools-screenshot-gallery">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Screenshot Gallery
            </CardTitle>
            <CardDescription>
              {screenshots.length} screenshot{screenshots.length !== 1 ? 's' : ''} captured
            </CardDescription>
          </div>
          {isElectronEnv ? (
            <Button onClick={handleOpenFolder} size="sm" variant="outline">
              <FolderOpen className="h-4 w-4 mr-2" />
              Open Folder
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">Loading screenshots...</div>
        ) : screenshots.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Monitor className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No screenshots captured yet</p>
            <p className="text-sm mt-2">
              {isElectronEnv
                ? 'Start monitoring to capture screenshots automatically'
                : 'Screenshots from synced monitoring sessions will appear here'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {screenshots.slice(0, 12).map((screenshot) => (
              <div
                key={screenshot.id}
                className="group relative border rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setSelectedScreenshot(screenshot)}
              >
                {screenshot.dataUrl ? (
                  <img
                    src={screenshot.dataUrl}
                    alt={`Screenshot ${screenshot.id}`}
                    className="w-full h-48 object-cover"
                  />
                ) : (
                  <div className="w-full h-48 bg-muted flex items-center justify-center">
                    <Monitor className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
                <div className="p-3 bg-background">
                  <div className="text-xs text-muted-foreground">
                    {formatTimestamp(screenshot.timestamp)}
                  </div>
                  {screenshot.privacyLevel && (
                    <Badge variant="outline" className="mt-1 text-xs">
                      {screenshot.privacyLevel === 'blurred' ? (
                        <>
                          <EyeOff className="h-3 w-3 mr-1" />
                          Blurred
                        </>
                      ) : (
                        <>
                          <Eye className="h-3 w-3 mr-1" />
                          Normal
                        </>
                      )}
                    </Badge>
                  )}
                  {screenshot.workStatus && (
                    <Badge variant="secondary" className="mt-1 ml-1 text-xs">
                      {screenshot.workStatus}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={!!selectedScreenshot} onOpenChange={() => setSelectedScreenshot(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Screenshot Details</DialogTitle>
            <DialogDescription>
              {selectedScreenshot && formatTimestamp(selectedScreenshot.timestamp)}
            </DialogDescription>
          </DialogHeader>
          {selectedScreenshot?.dataUrl && (
            <div className="space-y-4">
              <img
                src={selectedScreenshot.dataUrl}
                alt="Screenshot"
                className="w-full rounded-lg border"
              />
              <div className="grid grid-cols-2 gap-4 text-sm">
                {selectedScreenshot.filename && (
                  <div>
                    <span className="text-muted-foreground">Filename:</span>
                    <div className="font-mono">{selectedScreenshot.filename}</div>
                  </div>
                )}
                {selectedScreenshot.activeWindow && (
                  <div>
                    <span className="text-muted-foreground">Active Window:</span>
                    <div>{selectedScreenshot.activeWindow}</div>
                  </div>
                )}
                {selectedScreenshot.workStatus && (
                  <div>
                    <span className="text-muted-foreground">Work Status:</span>
                    <div>{selectedScreenshot.workStatus}</div>
                  </div>
                )}
                {selectedScreenshot.privacyLevel && (
                  <div>
                    <span className="text-muted-foreground">Privacy Level:</span>
                    <div>{selectedScreenshot.privacyLevel}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}

