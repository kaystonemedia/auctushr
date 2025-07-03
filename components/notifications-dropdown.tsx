'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'
import { useNewAuth } from '@/contexts/new-auth-context'
import { subscribeToNotifications, markNotificationAsRead, getUnreadNotifications } from '@/lib/notifications'
import { AttendanceNotification } from '@/types/attendance'
import { toast } from 'react-hot-toast'

interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  read: boolean
  createdAt: Date
}

export function NotificationsDropdown() {
  const { user } = useNewAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Load initial notifications
  useEffect(() => {
    if (!user?.id) return

    const loadNotifications = async () => {
      try {
        setLoading(true)
        const unreadNotifications = await getUnreadNotifications(user.id)
        
        // Convert AttendanceNotification to Notification format
        const convertedNotifications: Notification[] = unreadNotifications.map(notif => ({
          id: notif.id,
          title: notif.type === 'late_check_in' ? 'Late Check-in' :
                 notif.type === 'absent' ? 'Absent' :
                 notif.type === 'flag_raised' ? 'Flag Raised' :
                 notif.type === 'approval_required' ? 'Approval Required' :
                 notif.type === 'approved' ? 'Approved' :
                 notif.type === 'rejected' ? 'Rejected' : 'Notification',
          message: notif.message,
          type: notif.severity === 'high' ? 'error' :
                notif.severity === 'medium' ? 'warning' : 'info',
          read: notif.read,
          createdAt: notif.createdAt
        }))
        
        // Filter out notifications with invalid IDs and log them for debugging
        const validNotifications = convertedNotifications.filter(notif => {
          if (!notif.id || notif.id.trim() === '') {
            console.warn('Found notification with invalid ID:', notif)
            return false
          }
          return true
        })
        
        setNotifications(validNotifications)
      } catch (error) {
        console.error('Error loading notifications:', error)
        toast.error('Failed to load notifications')
      } finally {
        setLoading(false)
      }
    }

    loadNotifications()
  }, [user?.id])

  // Set up real-time subscription
  useEffect(() => {
    if (!user?.id) return

    const unsubscribe = subscribeToNotifications(user.id, (newNotification: AttendanceNotification) => {
      // Convert and add new notification
      const convertedNotification: Notification = {
        id: newNotification.id,
        title: newNotification.type === 'late_check_in' ? 'Late Check-in' :
               newNotification.type === 'absent' ? 'Absent' :
               newNotification.type === 'flag_raised' ? 'Flag Raised' :
               newNotification.type === 'approval_required' ? 'Approval Required' :
               newNotification.type === 'approved' ? 'Approved' :
               newNotification.type === 'rejected' ? 'Rejected' : 'Notification',
        message: newNotification.message,
        type: newNotification.severity === 'high' ? 'error' :
              newNotification.severity === 'medium' ? 'warning' : 'info',
        read: newNotification.read,
        createdAt: newNotification.createdAt
      }

      // Only add notification if it has a valid ID
      if (convertedNotification.id && convertedNotification.id.trim() !== '') {
        setNotifications(prev => [convertedNotification, ...prev])
        
        // Show toast for new notifications
        toast.success(convertedNotification.message, {
          duration: 4000,
          position: 'top-right'
        })
      } else {
        console.warn('Received notification with invalid ID:', convertedNotification)
      }
    })

    return () => unsubscribe()
  }, [user?.id])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      if (!notificationId || notificationId.trim() === '') {
        toast.error('Invalid notification ID')
        return
      }
      
      await markNotificationAsRead(notificationId)
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      )
    } catch (error) {
      console.error('Error marking notification as read:', error)
      toast.error('Failed to mark notification as read')
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.read && n.id && n.id.trim() !== '')
      
      if (unreadNotifications.length === 0) {
        toast('No unread notifications to mark')
        return
      }
      
      await Promise.all(unreadNotifications.map(n => markNotificationAsRead(n.id)))
      setNotifications(prev =>
        prev.map(n => n.id && n.id.trim() !== '' ? { ...n, read: true } : n)
      )
      toast.success('All notifications marked as read')
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
      toast.error('Failed to mark all notifications as read')
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-700 hover:text-gray-900"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full">
            {unreadCount}
          </span>
        )}
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 mt-2 w-80 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50"
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Mark all as read
                  </button>
                )}
              </div>

              <div className="max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="text-center py-4 text-gray-500">
                    Loading notifications...
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    No notifications
                  </div>
                ) : (
                  <div className="space-y-4">
                    {notifications.map((notification, index) => (
                      <div
                        key={notification.id || `notification-${index}`}
                        className={cn(
                          "p-3 rounded-lg",
                          notification.read ? "bg-gray-50" : "bg-blue-50",
                          notification.type === "success" && "bg-green-50",
                          notification.type === "warning" && "bg-yellow-50",
                          notification.type === "error" && "bg-red-50"
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{notification.title}</p>
                            <p className="mt-1 text-sm text-gray-600">{notification.message}</p>
                            <p className="mt-1 text-xs text-gray-500">
                              {new Date(notification.createdAt).toLocaleString()}
                            </p>
                          </div>
                          {!notification.read && notification.id && notification.id.trim() !== '' && (
                            <button
                              onClick={() => handleMarkAsRead(notification.id)}
                              className="text-sm text-blue-600 hover:text-blue-800"
                            >
                              Mark as read
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
} 