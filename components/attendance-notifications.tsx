import { AttendanceNotification } from '@/types/attendance'
import { Bell, Clock, AlertCircle, CheckCircle, XCircle } from 'lucide-react'

interface AttendanceNotificationsProps {
  notifications: AttendanceNotification[]
  onMarkAsRead: (notificationId: string) => Promise<void>
}

export function AttendanceNotifications({ notifications, onMarkAsRead }: AttendanceNotificationsProps) {
  const getNotificationIcon = (type: AttendanceNotification['type']) => {
    switch (type) {
      case 'late_check_in':
        return <Clock className="h-5 w-5 text-yellow-500" />
      case 'absent':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case 'flag_raised':
        return <AlertCircle className="h-5 w-5 text-orange-500" />
      case 'approval_required':
        return <Bell className="h-5 w-5 text-blue-500" />
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <Bell className="h-5 w-5 text-gray-500" />
    }
  }

  const getNotificationColor = (type: AttendanceNotification['type']) => {
    switch (type) {
      case 'late_check_in':
        return 'bg-yellow-50 text-yellow-800'
      case 'absent':
        return 'bg-red-50 text-red-800'
      case 'flag_raised':
        return 'bg-orange-50 text-orange-800'
      case 'approval_required':
        return 'bg-blue-50 text-blue-800'
      case 'approved':
        return 'bg-green-50 text-green-800'
      case 'rejected':
        return 'bg-red-50 text-red-800'
      default:
        return 'bg-gray-50 text-gray-800'
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Attendance Notifications</h2>
      </div>
      <div className="divide-y divide-gray-200">
        {notifications.length === 0 ? (
          <div className="px-6 py-4 text-center text-gray-500">
            No notifications
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`px-6 py-4 ${!notification.read ? 'bg-blue-50' : ''}`}
            >
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {notification.message}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                </div>
                {!notification.read && (
                  <button
                    onClick={() => onMarkAsRead(notification.id)}
                    className="ml-4 text-sm text-blue-600 hover:text-blue-900"
                  >
                    Mark as read
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
} 