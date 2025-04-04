'use client'

import { useState, useEffect } from 'react'
import { Bell, Check, X } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { subscribeToNotifications, markNotificationAsRead, getUnreadNotificationsCount } from '@/lib/notifications'
import { AttendanceNotification } from '@/types/attendance'
import { toast } from 'react-hot-toast'

export function NotificationsDropdown() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<AttendanceNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!user) return

    // Subscribe to new notifications
    const unsubscribe = subscribeToNotifications(user.id, (notification) => {
      setNotifications(prev => [notification, ...prev])
      setUnreadCount(prev => prev + 1)
      toast(notification.message, {
        icon: getNotificationIcon(notification.type),
        duration: 5000
      })
    })

    // Get initial unread count
    getUnreadNotificationsCount(user.id).then(setUnreadCount)

    return () => unsubscribe()
  }, [user])

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId)
      setNotifications(prev =>
        prev.map(notification =>
          notification.id === notificationId
            ? { ...notification, read: true }
            : notification
        )
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Error marking notification as read:', error)
      toast.error('Failed to mark notification as read')
    }
  }

  const getNotificationIcon = (type: AttendanceNotification['type']) => {
    switch (type) {
      case 'late_check_in':
        return '⏰'
      case 'absent':
        return '❌'
      case 'flag_raised':
        return '⚠️'
      case 'approval_required':
        return '📝'
      case 'approved':
        return '✅'
      case 'rejected':
        return '❌'
      default:
        return '📢'
    }
  }

  const getNotificationColor = (type: AttendanceNotification['type']) => {
    switch (type) {
      case 'late_check_in':
        return 'text-yellow-600'
      case 'absent':
        return 'text-red-600'
      case 'flag_raised':
        return 'text-orange-600'
      case 'approval_required':
        return 'text-blue-600'
      case 'approved':
        return 'text-green-600'
      case 'rejected':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none"
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 z-50">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No notifications
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border-b border-gray-200 ${
                    !notification.read ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${getNotificationColor(notification.type)}`}>
                        {notification.message}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {new Date(notification.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {!notification.read && (
                      <button
                        onClick={() => handleMarkAsRead(notification.id)}
                        className="ml-2 text-gray-400 hover:text-gray-500"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={() => setIsOpen(false)}
              className="w-full text-sm text-gray-600 hover:text-gray-900"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
} 