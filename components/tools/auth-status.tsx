'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2 } from 'lucide-react'
import { useElectronFeatures } from '@/lib/electron-bridge'
import { useNewAuth } from '@/contexts/new-auth-context'

export function AuthStatus() {
  const { electronAPI, isElectron: isElectronEnv } = useElectronFeatures()
  const { user } = useNewAuth()
  const [authStatus, setAuthStatus] = useState<{ authenticated: boolean; email: string }>({
    authenticated: false,
    email: 'offline@local.app',
  })

  useEffect(() => {
    if (!isElectronEnv || !electronAPI) {
      // Fallback to web auth
      if (user) {
        setAuthStatus({
          authenticated: true,
          email: user.email || 'user@example.com',
        })
      }
      return
    }

    const loadAuthStatus = async () => {
      try {
        const status = await electronAPI.getMonitoringStatus?.()
        if (status?.userData) {
          setAuthStatus({
            authenticated: true,
            email: status.userData.email || user?.email || 'offline@local.app',
          })
        } else if (user) {
          setAuthStatus({
            authenticated: true,
            email: user.email || 'user@example.com',
          })
        }
      } catch (error) {
        console.error('Failed to load auth status:', error)
        if (user) {
          setAuthStatus({
            authenticated: true,
            email: user.email || 'user@example.com',
          })
        }
      }
    }

    loadAuthStatus()

    // Listen for auth changes
    const handleAuthChange = (data: { user?: { email?: string } }) => {
      if (data?.user) {
        setAuthStatus({
          authenticated: true,
          email: data.user.email || user?.email || 'offline@local.app',
        })
      }
    }

    electronAPI.onAuthStateChanged?.(handleAuthChange)
  }, [isElectronEnv, electronAPI, user])

  return (
    <Card className="bg-accent/10 border-accent/20">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="h-5 w-5 text-accent" />
          <span className="font-semibold text-card-foreground">Authenticated</span>
        </div>
        <div className="text-sm text-muted-foreground mb-1">{authStatus.email}</div>
        <div className="text-xs text-muted-foreground">Session is active and synced to your account.</div>
      </CardContent>
    </Card>
  )
}

