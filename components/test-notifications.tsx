'use client'

import { useState } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { useNewAuth } from '@/contexts/new-auth-context'
import { 
  sendCustomNotification, 
  sendProductivityNotification, 
  sendBreakReminder,
  sendTaskCompletionNotification 
} from '@/lib/notifications'
import { toast } from 'react-hot-toast'

export function TestNotifications() {
  const { user } = useNewAuth()
  const [loading, setLoading] = useState(false)

  const sendTestNotification = async (type: string) => {
    if (!user?.id) {
      toast.error('User not authenticated')
      return
    }

    setLoading(true)
    try {
      switch (type) {
        case 'custom':
          await sendCustomNotification(
            user.id,
            'Test Notification',
            'This is a test notification to verify the real-time system is working.',
            'info'
          )
          break
        case 'productivity':
          await sendProductivityNotification(
            user.id,
            'high_productivity',
            { productivityScore: 85, sessionHours: 4 }
          )
          break
        case 'break':
          await sendBreakReminder(user.id, 'lunch')
          break
        case 'task':
          await sendTaskCompletionNotification(
            user.id,
            {
              title: 'Test Task',
              completedAt: new Date(),
              priority: 'medium'
            }
          )
          break
        default:
          toast.error('Unknown notification type')
          return
      }
      toast.success(`Test ${type} notification sent!`)
    } catch (error) {
      console.error('Error sending test notification:', error)
      toast.error('Failed to send test notification')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Test Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">Please log in to test notifications</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test Notifications</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          Click the buttons below to test different types of notifications. 
          Check the notification dropdown in the header to see them appear in real-time.
        </p>
        
        <div className="grid grid-cols-2 gap-4">
          <Button
            onClick={() => sendTestNotification('custom')}
            disabled={loading}
            variant="outline"
          >
            Send Custom Notification
          </Button>
          
          <Button
            onClick={() => sendTestNotification('productivity')}
            disabled={loading}
            variant="outline"
          >
            Send Productivity Notification
          </Button>
          
          <Button
            onClick={() => sendTestNotification('break')}
            disabled={loading}
            variant="outline"
          >
            Send Break Reminder
          </Button>
          
          <Button
            onClick={() => sendTestNotification('task')}
            disabled={loading}
            variant="outline"
          >
            Send Task Completion
          </Button>
        </div>
        
        {loading && (
          <p className="text-sm text-blue-600">Sending notification...</p>
        )}
      </CardContent>
    </Card>
  )
} 