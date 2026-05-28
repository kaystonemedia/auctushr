'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Monitor, X, Download, CheckCircle } from 'lucide-react'
import { useNewAuth } from '@/contexts/new-auth-context'

interface DesktopAppPopupProps {
  isOpen: boolean
  onClose: () => void
}

const DESKTOP_APP_DOWNLOAD_URL = 'https://drive.google.com/file/d/1sLQ3t6qgUQ0ACTv_iZxxQXxtInO5ksFD/view?usp=sharing'

export function DesktopAppPopup({ isOpen, onClose }: DesktopAppPopupProps) {
  const { user } = useNewAuth()
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [isGeneratingToken, setIsGeneratingToken] = useState(false)

  useEffect(() => {
    if (isOpen && user && !authToken) {
      generateAuthToken()
    }
  }, [isOpen, user, authToken])

  const generateAuthToken = async () => {
    if (!user) return

    setIsGeneratingToken(true)
    try {
      const response = await fetch('/api/auth/token', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('No active Supabase session')
      }
      const payload = await response.json()
      if (!payload.token) {
        throw new Error('Missing access token')
      }
      setAuthToken(payload.token)
    } catch (error) {
      console.error('Failed to fetch Supabase session token:', error)
    } finally {
      setIsGeneratingToken(false)
    }
  }

  const openDesktopApp = () => {
    if (!authToken || !user) {
      alert('Authentication not ready. Please try again.')
      return
    }

    const authData = {
      token: authToken,
      user: {
        uid: user.uid || user.id,
        email: user.email,
        name: user.name || user.email,
        role: user.role || 'employee'
      }
    }

    const protocolUrl = `auctushr://auth/login?token=${encodeURIComponent(authToken)}&user=${encodeURIComponent(JSON.stringify(authData.user))}`

    try {
      localStorage.setItem('desktopAuthData', JSON.stringify(authData))
      localStorage.setItem('desktopAuthTimestamp', Date.now().toString())

      const iframe = document.createElement('iframe')
      iframe.style.display = 'none'
      iframe.src = protocolUrl

      let didLaunch = false
      let fallbackTimeout: ReturnType<typeof setTimeout>

      const cleanup = () => {
        window.removeEventListener('blur', handleLaunchSuccess)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        if (fallbackTimeout) clearTimeout(fallbackTimeout)
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
      }

      const handleLaunchSuccess = () => {
        if (didLaunch) return
        didLaunch = true
        cleanup()
        onClose()
      }

      const handleVisibilityChange = () => {
        if (document.hidden) handleLaunchSuccess()
      }

      fallbackTimeout = setTimeout(() => {
        if (!didLaunch) {
          cleanup()
          showManualInstructions()
        }
      }, 3500)

      window.addEventListener('blur', handleLaunchSuccess)
      document.addEventListener('visibilitychange', handleVisibilityChange)
      document.body.appendChild(iframe)

      setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
      }, 2000)
    } catch {
      showManualInstructions()
    }
  }

  const showManualInstructions = () => {
    alert(
      'Authentication data saved. Open or restart the Auctushr desktop app, or use Sign in with browser in the app.'
    )
    onClose()
  }

  const handleDownloadClick = () => {
    window.open(DESKTOP_APP_DOWNLOAD_URL, '_blank', 'noopener,noreferrer')
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Monitor className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <DialogTitle>Open Desktop App</DialogTitle>
              <DialogDescription>
                Get enhanced productivity monitoring with the Auctushr desktop app
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Desktop App Features:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Automatic time tracking
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Productivity monitoring
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Screenshot capture
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Focus session tracking
              </li>
            </ul>
          </div>

          {isGeneratingToken ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Preparing authentication...</p>
            </div>
          ) : authToken ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                Authentication ready
              </div>
              <div className="flex gap-2">
                <Button onClick={openDesktopApp} className="flex-1">
                  <Monitor className="h-4 w-4 mr-2" />
                  Open Desktop App
                </Button>
                <Button variant="outline" onClick={handleDownloadClick}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
              <Button variant="ghost" onClick={onClose} className="w-full mt-2 text-sm">
                Skip for now
              </Button>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-600 mb-3">Failed to prepare authentication</p>
              <Button onClick={generateAuthToken} variant="outline" size="sm">
                Try Again
              </Button>
            </div>
          )}

          <p className="text-xs text-gray-500 text-center">
            Your Supabase session will be securely transferred to the desktop app
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="absolute right-4 top-4 h-6 w-6 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </DialogContent>
    </Dialog>
  )
}