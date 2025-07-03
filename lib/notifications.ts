import { db } from '@/lib/firebase'
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  onSnapshot,
  Timestamp,
  doc,
  updateDoc,
  or,
  and,
  deleteDoc
} from 'firebase/firestore'
import { AttendanceNotification, AttendanceRecord, AttendanceSettings } from '@/types/attendance'
import { toast } from 'react-hot-toast'

interface NotificationOptions {
  type: 'break' | 'meeting' | 'idle' | 'late' | 'early' | 'custom'
  message: string
  severity: 'info' | 'warning' | 'error'
  employeeId: string
  data?: any
}

export async function createNotification(options: NotificationOptions): Promise<void> {
  try {
    // Validate that we have a valid employee ID
    if (!options.employeeId || options.employeeId.trim() === '') {
      console.warn('Skipping notification creation: Invalid employee ID')
      return
    }

    const notification = {
      // Don't include id field - Firestore will auto-generate it
      type: options.type,
      employeeId: options.employeeId,
      message: options.message,
      severity: options.severity,
      read: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      data: options.data || null // Ensure data is never undefined
    }

    const docRef = await addDoc(collection(db, 'notifications'), notification)
    console.log('Notification created with ID:', docRef.id)
  } catch (error) {
    console.error('Error creating notification:', error)
    throw error
  }
}

export function subscribeToNotifications(
  userId: string,
  onNotification: (notification: AttendanceNotification) => void
) {
  const notificationsRef = collection(db, 'notifications')
  
  // Query for notifications where user is the employee (since we only use employeeId)
  const q = query(
    notificationsRef,
    where('employeeId', '==', userId),
    orderBy('createdAt', 'desc')
  )

  return onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const docId = change.doc.id
        if (!docId || docId.trim() === '') {
          console.warn('Skipping notification with invalid ID:', change.doc.data())
          return
        }
        
        const docData = change.doc.data()
        const notification = {
          id: docId,
          ...docData,
          createdAt: docData.createdAt?.toDate() || new Date(),
          updatedAt: docData.updatedAt?.toDate() || new Date()
        } as AttendanceNotification
        onNotification(notification)
      }
    })
  })
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    if (!notificationId || notificationId.trim() === '') {
      throw new Error('Invalid notification ID: ID cannot be empty')
    }
    
    const notificationRef = doc(db, 'notifications', notificationId)
    await updateDoc(notificationRef, {
      read: true,
      updatedAt: new Date()
    })
  } catch (error) {
    console.error('Error marking notification as read:', error)
    throw error
  }
}

export async function getUnreadNotifications(employeeId: string): Promise<AttendanceNotification[]> {
  try {
    const q = query(
      collection(db, 'notifications'),
      and(
        where('employeeId', '==', employeeId),
        where('read', '==', false)
      ),
      orderBy('createdAt', 'desc')
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date()
    } as AttendanceNotification))
  } catch (error) {
    console.error('Error fetching notifications:', error)
    throw error
  }
}

// Break Time Reminder
export async function scheduleBreakReminder(employeeId: string, settings: AttendanceSettings): Promise<void> {
  const now = new Date()
  const workingHours = settings.workingHours
  const [startHour, startMinute] = workingHours.start.split(':').map(Number)
  const [endHour, endMinute] = workingHours.end.split(':').map(Number)

  const startTime = new Date(now)
  startTime.setHours(startHour, startMinute, 0, 0)

  const endTime = new Date(now)
  endTime.setHours(endHour, endMinute, 0, 0)

  if (now >= startTime && now <= endTime) {
    await createNotification({
      type: 'break',
      message: 'Break Time Reminder: It\'s time for your scheduled break. Taking regular breaks helps maintain productivity.',
      severity: 'info',
      employeeId
    })
  }
}

// Meeting Notification
export async function sendMeetingNotification(employeeId: string, meetingData: any): Promise<void> {
  await createNotification({
    type: 'meeting',
    message: `Upcoming Meeting: You have a meeting scheduled: ${meetingData.title} at ${new Date(meetingData.startTime).toLocaleTimeString()}`,
    severity: 'info',
    employeeId,
    data: meetingData
  })
}

// Idle Time Warning
export async function sendIdleWarning(employeeId: string, idleTime: number, settings: AttendanceSettings): Promise<void> {
  if (idleTime >= settings.idleThreshold) {
    await createNotification({
      type: 'idle',
      message: `Idle Time Warning: You've been idle for ${idleTime} minutes. Consider taking a break or resuming work.`,
      severity: 'warning',
      employeeId,
      data: { idleTime }
    })
  }
}

// Late Arrival Notification
export async function sendLateArrivalNotification(employeeId: string, checkInTime: Date, settings: AttendanceSettings): Promise<void> {
  const [startHour, startMinute] = settings.workingHours.start.split(':').map(Number)
  const startTime = new Date(checkInTime)
  startTime.setHours(startHour, startMinute, 0, 0)

  const lateMinutes = Math.floor((checkInTime.getTime() - startTime.getTime()) / (1000 * 60))
  if (lateMinutes > settings.allowedLateMinutes) {
    await createNotification({
      type: 'late',
      message: `Late Arrival: You arrived ${lateMinutes} minutes late. Please ensure timely arrival.`,
      severity: 'warning',
      employeeId,
      data: { lateMinutes, checkInTime }
    })
  }
}

// Early Departure Notification
export async function sendEarlyDepartureNotification(employeeId: string, checkOutTime: Date, settings: AttendanceSettings): Promise<void> {
  const [endHour, endMinute] = settings.workingHours.end.split(':').map(Number)
  const endTime = new Date(checkOutTime)
  endTime.setHours(endHour, endMinute, 0, 0)

  if (checkOutTime < endTime) {
    const earlyMinutes = Math.floor((endTime.getTime() - checkOutTime.getTime()) / (1000 * 60))
    await createNotification({
      type: 'early',
      message: `Early Departure: You left ${earlyMinutes} minutes early. Please ensure you complete your working hours.`,
      severity: 'warning',
      employeeId,
      data: { earlyMinutes, checkOutTime }
    })
  }
}

// Custom Notification
export async function sendCustomNotification(employeeId: string, title: string, message: string, severity: 'info' | 'warning' | 'error' = 'info'): Promise<void> {
  await createNotification({
    type: 'custom',
    message: `${title}: ${message}`,
    severity,
    employeeId
  })
}

// Productivity-based notifications
export async function sendProductivityNotification(
  employeeId: string, 
  type: 'low_productivity' | 'high_productivity' | 'idle_warning' | 'focus_reminder',
  data?: any
): Promise<void> {
  const notificationMessages = {
    low_productivity: {
      title: 'Low Productivity Alert',
      message: 'Your productivity has been below average today. Consider taking a break or focusing on priority tasks.',
      severity: 'warning' as const
    },
    high_productivity: {
      title: 'Great Work!',
      message: 'You\'re having a highly productive day! Keep up the excellent work.',
      severity: 'info' as const
    },
    idle_warning: {
      title: 'Idle Time Warning',
      message: `You've been inactive for ${data?.idleTime || 'a while'}. Consider resuming work or taking a scheduled break.`,
      severity: 'warning' as const
    },
    focus_reminder: {
      title: 'Focus Reminder',
      message: 'It\'s time for a focused work session. Minimize distractions and concentrate on your tasks.',
      severity: 'info' as const
    }
  }

  const config = notificationMessages[type]
  
  await createNotification({
    type: 'custom',
    message: `${config.title}: ${config.message}`,
    severity: config.severity,
    employeeId,
    data
  })
}

// Meeting reminder notifications
export async function sendMeetingReminder(
  employeeId: string,
  meetingData: {
    title: string
    startTime: Date
    duration: number
  }
): Promise<void> {
  const minutesUntilMeeting = Math.floor(
    (meetingData.startTime.getTime() - new Date().getTime()) / (1000 * 60)
  )

  await createNotification({
    type: 'meeting',
    message: `Meeting Reminder: Your meeting "${meetingData.title}" starts in ${minutesUntilMeeting} minutes.`,
    severity: 'info',
    employeeId,
    data: meetingData
  })
}

// Break time notifications
export async function sendBreakReminder(
  employeeId: string,
  breakType: 'morning' | 'lunch' | 'afternoon' | 'end_of_day'
): Promise<void> {
  const breakMessages = {
    morning: 'Time for your morning break. Take a short rest to maintain productivity.',
    lunch: 'It\'s lunch time! Take a proper break to recharge.',
    afternoon: 'Time for your afternoon break. A short rest will help maintain focus.',
    end_of_day: 'Great work today! Consider wrapping up your tasks and preparing for tomorrow.'
  }

  await createNotification({
    type: 'break',
    message: `Break Time: ${breakMessages[breakType]}`,
    severity: 'info',
    employeeId,
    data: { breakType }
  })
}

// Task assignment notifications
export async function sendTaskAssignmentNotification(
  employeeId: string,
  taskData: {
    title: string
    description: string
    assignedBy: string
    priority: 'low' | 'medium' | 'high' | 'urgent'
  }
): Promise<void> {
  await createNotification({
    type: 'custom',
    message: `New Task Assigned: ${taskData.title} - ${taskData.description} (Assigned by: ${taskData.assignedBy})`,
    severity: taskData.priority === 'high' ? 'warning' : 'info',
    employeeId,
    data: taskData
  })
}

// Task completion notifications with feedback
export async function sendTaskCompletionNotification(
  employeeId: string,
  taskData: {
    title: string
    completedAt: Date
    priority: 'low' | 'medium' | 'high' | 'urgent'
  }
): Promise<void> {
  await createNotification({
    type: 'custom',
    message: `Task Completed: Great job! You've completed "${taskData.title}".`,
    severity: 'info',
    employeeId,
    data: taskData
  })
}

// Task completion feedback to manager
export async function sendTaskCompletionFeedbackToManager(
  managerId: string,
  taskData: {
    title: string
    employeeName: string
    completedAt: Date
    quality?: number
    feedback?: string
  }
): Promise<void> {
  await createNotification({
    type: 'custom',
    message: `Task Completed by ${taskData.employeeName}: "${taskData.title}" has been completed successfully.`,
    severity: 'info',
    employeeId: managerId,
    data: taskData
  })
}

// Congratulations notifications
export async function sendCongratulationsNotification(
  employeeId: string,
  message: string
): Promise<void> {
  await createNotification({
    type: 'custom',
    message: `Congratulations! ${message}`,
    severity: 'info',
    employeeId,
    data: { type: 'congratulations' }
  })
}

// Document update notifications
export async function sendDocumentUpdateNotification(
  employeeId: string,
  documentData: {
    title: string
    updatedBy: string
    updateType: 'created' | 'modified' | 'deleted'
  }
): Promise<void> {
  const actionText = documentData.updateType === 'created' ? 'created' :
                   documentData.updateType === 'modified' ? 'updated' : 'deleted'
  
  await createNotification({
    type: 'custom',
    message: `Document ${actionText}: "${documentData.title}" has been ${actionText} by ${documentData.updatedBy}.`,
    severity: 'info',
    employeeId,
    data: documentData
  })
}

// System-wide announcements
export async function sendSystemAnnouncement(
  employeeIds: string[],
  announcement: {
    title: string
    message: string
    priority: 'low' | 'medium' | 'high' | 'urgent'
  }
): Promise<void> {
  for (const employeeId of employeeIds) {
    await createNotification({
      type: 'custom',
      message: `System Announcement: ${announcement.title} - ${announcement.message}`,
      severity: announcement.priority === 'high' ? 'warning' : 'info',
      employeeId,
      data: { type: 'system_announcement', ...announcement }
    })
  }
}

// Department-wide notifications
export async function sendDepartmentNotification(
  departmentName: string,
  notification: {
    title: string
    message: string
    sentBy: string
  }
): Promise<void> {
  // Get all employees in the department
  const employeesRef = collection(db, 'employees')
  const q = query(employeesRef, where('department', '==', departmentName))
  const employeesSnapshot = await getDocs(q)
  
  const employeeIds = employeesSnapshot.docs.map(doc => doc.data().uid || doc.id)
  
  for (const employeeId of employeeIds) {
    await createNotification({
      type: 'custom',
      message: `Department Notification: ${notification.title} - ${notification.message} (From: ${notification.sentBy})`,
      severity: 'info',
      employeeId,
      data: { type: 'department_notification', ...notification }
    })
  }
}

// Performance milestone notifications
export async function sendPerformanceMilestoneNotification(
  employeeId: string,
  milestone: {
    type: 'productivity_streak' | 'attendance_perfect' | 'task_completion' | 'focus_time'
    value: number
    period: string
  }
): Promise<void> {
  const milestoneMessages = {
    productivity_streak: `Congratulations! You've maintained high productivity for ${milestone.value} ${milestone.period}.`,
    attendance_perfect: `Perfect attendance! You've been on time for ${milestone.value} ${milestone.period}.`,
    task_completion: `Excellent work! You've completed ${milestone.value} tasks this ${milestone.period}.`,
    focus_time: `Great focus! You've achieved ${milestone.value} hours of focused work this ${milestone.period}.`
  }

  await createNotification({
    type: 'custom',
    message: `Performance Milestone: ${milestoneMessages[milestone.type]}`,
    severity: 'info',
    employeeId,
    data: milestone
  })
}

// Manager notifications for team events
export async function sendManagerNotification(
  managerId: string,
  type: 'team_late' | 'team_absent' | 'team_productivity' | 'approval_required',
  data: any
): Promise<void> {
  const managerMessages = {
    team_late: `${data.employeeName} arrived ${data.lateMinutes} minutes late today.`,
    team_absent: `${data.employeeName} is absent today.`,
    team_productivity: `${data.employeeName}'s productivity is ${data.productivityScore}% today.`,
    approval_required: `${data.employeeName} requires approval for their attendance record.`
  }

  await createNotification({
    type: 'custom',
    message: `Team Update: ${managerMessages[type]}`,
    severity: type === 'approval_required' ? 'warning' : 'info',
    employeeId: managerId, // For managers, we use their ID as employeeId
    data
  })
}

// Clean up invalid notifications
export async function cleanupInvalidNotifications(): Promise<void> {
  try {
    const notificationsRef = collection(db, 'notifications')
    const snapshot = await getDocs(notificationsRef)
    
    const invalidNotifications: string[] = []
    
    snapshot.forEach((doc) => {
      const data = doc.data()
      if (!data.employeeId || data.employeeId.trim() === '') {
        invalidNotifications.push(doc.id)
      }
    })
    
    console.log(`Found ${invalidNotifications.length} invalid notifications to clean up`)
    
    // Delete invalid notifications
    for (const notificationId of invalidNotifications) {
      try {
        await deleteDoc(doc(db, 'notifications', notificationId))
        console.log(`Deleted invalid notification: ${notificationId}`)
      } catch (error) {
        console.error(`Failed to delete notification ${notificationId}:`, error)
      }
    }
    
    console.log('Cleanup completed')
  } catch (error) {
    console.error('Error during cleanup:', error)
  }
}