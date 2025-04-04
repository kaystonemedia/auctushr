import { db } from './firebase'
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
import { AttendanceNotification } from '@/types/attendance'

export async function createNotification(notification: Omit<AttendanceNotification, 'id' | 'createdAt'>) {
  try {
    const notificationsRef = collection(db, 'notifications')
    const newNotification = {
      ...notification,
      createdAt: Timestamp.now(),
      read: false
    }
    
    const docRef = await addDoc(notificationsRef, newNotification)
    return { id: docRef.id, ...newNotification }
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

export async function markNotificationAsRead(notificationId: string) {
  try {
    const notificationRef = doc(db, 'notifications', notificationId)
    await updateDoc(notificationRef, {
      read: true
    })
  } catch (error) {
    console.error('Error marking notification as read:', error)
    throw error
  }
}

export async function getUnreadNotificationsCount(userId: string): Promise<number> {
  try {
    const notificationsRef = collection(db, 'notifications')
    const q = query(
      notificationsRef,
      where('managerId', '==', userId),
      where('read', '==', false)
    )
    
    const snapshot = await getDocs(q)
    return snapshot.size
  } catch (error) {
    console.error('Error getting unread notifications count:', error)
    return 0
  }
} 