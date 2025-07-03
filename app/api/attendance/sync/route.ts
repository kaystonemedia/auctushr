import { NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, updateDoc, doc, addDoc } from 'firebase/firestore'
import { auth } from '@/lib/firebase'
import { getAuth } from 'firebase/auth'

export async function POST(request: Request) {
  try {
    // Get request body
    const { session: activitySession, userId } = await request.json()
    if (!activitySession || !userId) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const { startTime, activities, idleTime, activeTime, isCheckOut, checkInLocation, deviceInfo } = activitySession

    // Find today's attendance record
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const attendanceQuery = query(
      collection(db, 'attendance'),
      where('employeeId', '==', userId),
      where('date', '>=', today)
    )
    const attendanceSnapshot = await getDocs(attendanceQuery)

    if (attendanceSnapshot.empty) {
      // Create new attendance record if none exists
      const attendanceData = {
        employeeId: userId,
        date: new Date(),
        checkIn: {
          time: new Date(startTime),
          location: checkInLocation,
          deviceInfo
        },
        activities: activities || [],
        idleTime: idleTime || 0,
        activeTime: activeTime || 0,
        status: 'present',
        approvalStatus: 'pending',
        lastSync: new Date().toISOString()
      }

      await addDoc(collection(db, 'attendance'), attendanceData)
    } else {
      // Update existing attendance record
      const attendanceDoc = attendanceSnapshot.docs[0]
      const attendanceData = attendanceDoc.data()

      // Update activities
      const updatedActivities = [
        ...(attendanceData.activities || []),
        ...(activities || [])
      ].slice(-1000) // Keep last 1000 activities

      // Update attendance record
      const updateData: any = {
        activities: updatedActivities,
        idleTime: (attendanceData.idleTime || 0) + (idleTime || 0),
        activeTime: (attendanceData.activeTime || 0) + (activeTime || 0),
        lastSync: new Date().toISOString()
      }

      // Handle check-out
      if (isCheckOut) {
        const checkOutActivity = activities?.find((a: { type: string; time: string; location?: any; deviceInfo?: any }) => a.type === 'check_out')
        if (checkOutActivity) {
          updateData.checkOut = {
            time: new Date(checkOutActivity.time),
            location: checkOutActivity.location,
            deviceInfo: checkOutActivity.deviceInfo
          }

          // Calculate work duration
          const checkInTime = new Date(attendanceData.checkIn.time)
          const checkOutTime = new Date(checkOutActivity.time)
          const workDuration = checkOutTime.getTime() - checkInTime.getTime()
          const workHours = workDuration / (1000 * 60 * 60)

          // Update status based on work hours
          if (workHours < 4) {
            updateData.status = 'half_day'
          } else if (workHours < 8) {
            updateData.status = 'early_leave'
          }
        }
      }

      await updateDoc(doc(db, 'attendance', attendanceDoc.id), updateData)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error syncing attendance:', error)
    return NextResponse.json(
      { error: 'Failed to sync attendance data' },
      { status: 500 }
    )
  }
} 