'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Bell, Trash2 } from 'lucide-react'
import { useElectronFeatures } from '@/lib/electron-bridge'
import { toast } from '@/components/ui/use-toast'

interface NotificationItem {
  id: string
  title?: string
  message?: string
  read?: boolean
}

export function NotificationsPanel() {
  const { electronAPI, isElectron: isElectronEnv } = useElectronFeatures()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const loadWebNotifications = async () => {
    try {
      const res = await fetch('/api/notifications?limit=10')
      if (!res.ok) return
      const data = await res.json()
      const items = (data.notifications || []) as NotificationItem[]
      setNotifications(items)
      setUnreadCount(items.filter((n) => !n.read).length)
    } catch (error) {
      console.error('Failed to load notifications:', error)
    }
  }

  useEffect(() => {
    if (isElectronEnv && electronAPI) {
      let cancelled = false
      const load = async () => {
        try {
          const notifs = await electronAPI.getNotifications?.()
          if (cancelled) return
          if (notifs && Array.isArray(notifs)) {
            setNotifications(notifs)
            setUnreadCount(notifs.filter((n: NotificationItem) => !n.read).length)
          }
        } catch (error) {
          console.error('Failed to load electron notifications:', error)
        }
      }
      load()
      electronAPI.onNotificationReceived?.((notification: NotificationItem) => {
        setNotifications((prev) => [notification, ...prev])
        setUnreadCount((prev) => prev + 1)
      })
      electronAPI.onNotificationsCleared?.(() => {
        setNotifications([])
        setUnreadCount(0)
      })
      const interval = setInterval(load, 10000)
      return () => {
        cancelled = true
        clearInterval(interval)
        electronAPI.removeAllListeners?.('notification-received')
        electronAPI.removeAllListeners?.('notifications-cleared')
      }
    }

    loadWebNotifications()
    const interval = setInterval(loadWebNotifications, 15000)
    return () => clearInterval(interval)
  }, [isElectronEnv, electronAPI])

  const handleClearAll = async () => {
    try {
      if (isElectronEnv && electronAPI) {
        electronAPI.clearAllNotifications?.()
      } else {
        await fetch('/api/notifications?all=true', { method: 'PUT' }).catch(() => null)
      }
      setNotifications([])
      setUnreadCount(0)
      toast({ title: 'Notifications cleared' })
    } catch (error) {
      console.error('Failed to clear notifications:', error)
      toast({
        title: 'Unable to clear notifications',
        variant: 'destructive',
      })
    }
  }

  const markRead = async (id: string) => {
    try {
      if (isElectronEnv && electronAPI?.markNotificationAsRead) {
        electronAPI.markNotificationAsRead(id)
      }
      await fetch(`/api/notifications?id=${id}`, { method: 'PUT' }).catch(() => null)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Failed to mark notification read:', error)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notifications
        </CardTitle>
        {unreadCount > 0 && (
          <Badge variant="destructive" className="flex h-6 w-6 items-center justify-center rounded-full p-0">
            {unreadCount}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No notifications</div>
        ) : (
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {notifications.slice(0, 5).map((notification, index) => (
              <button
                key={notification.id || index}
                type="button"
                onClick={() => notification.id && !notification.read && markRead(notification.id)}
                className="w-full rounded-lg border bg-card p-3 text-left text-sm hover:bg-muted/50"
              >
                <div className="font-medium">{notification.title || 'Notification'}</div>
                {notification.message ? (
                  <div className="mt-1 text-xs text-muted-foreground">{notification.message}</div>
                ) : null}
              </button>
            ))}
          </div>
        )}
        <Button
          onClick={handleClearAll}
          variant="outline"
          className="w-full"
          disabled={notifications.length === 0}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Clear all
        </Button>
      </CardContent>
    </Card>
  )
}
