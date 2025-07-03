import { NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { sendProductivityNotification } from '@/lib/notifications'

export async function POST(request: Request) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.split('Bearer ')[1]
    const decodedToken = await adminAuth.verifyIdToken(token)
    const userId = decodedToken.uid

    // Get request body
    const { type, data, timestamp } = await request.json()

    if (!type || !userId) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // Send productivity notification
    await sendProductivityNotification(userId, type, {
      ...data,
      timestamp: timestamp || new Date().toISOString()
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error processing productivity notification:', error)
    return NextResponse.json(
      { error: 'Failed to process notification' },
      { status: 500 }
    )
  }
} 