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
  updateDoc
} from 'firebase/firestore'
import { AttendanceNotification, AttendanceRecord, AttendanceSettings } from '@/types/attendance'
import { toast } from 'react-hot-toast'

interface NotificationOptions {
  type: 'break' | 'meeting' | 'idle' | 'late' | 'early' | 'custom'
  title: string
  message: string
  severity: 'info' | 'warning' | 'error'
  employeeId: string
  data?: any
}

export async function createNotification(options: NotificationOptions): Promise<void> {
  try {
    const notification: AttendanceNotification = {
      id: '', // Will be set by Firestore
      type: options.type,
      title: options.title,
      message: options.message,
      severity: options.severity,
      employeeId: options.employeeId,
      data: options.data,
      read: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    await addDoc(collection(db, 'notifications'), notification)
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
  const q = query(
    notificationsRef,
    where('managerId', '==', userId),
    orderBy('createdAt', 'desc')
  )

  return onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const notification = {
          id: change.doc.id,
          ...change.doc.data()
        } as AttendanceNotification
        onNotification(notification)
      }
    })
  })
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
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
      where('employeeId', '==', employeeId),
      where('read', '==', false)
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceNotification))
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
      title: 'Break Time Reminder',
      message: 'It\'s time for your scheduled break. Taking regular breaks helps maintain productivity.',
      severity: 'info',
      employeeId
    })
  }
}

// Meeting Notification
export async function sendMeetingNotification(employeeId: string, meetingData: any): Promise<void> {
  await createNotification({
    type: 'meeting',
    title: 'Upcoming Meeting',
    message: `You have a meeting scheduled: ${meetingData.title} at ${new Date(meetingData.startTime).toLocaleTimeString()}`,
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
      title: 'Idle Time Warning',
      message: `You've been idle for ${idleTime} minutes. Consider taking a break or resuming work.`,
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
      title: 'Late Arrival',
      message: `You arrived ${lateMinutes} minutes late. Please ensure timely arrival.`,
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
      title: 'Early Departure',
      message: `You left ${earlyMinutes} minutes early. Please ensure you complete your working hours.`,
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
    title,
    message,
    severity,
    employeeId
  })
} 