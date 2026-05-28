import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { notifyUser } from '@/lib/notify-user'

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['admin', 'manager'].includes(authResult.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { userIds, title, message, severity = 'info', type = 'custom' } = body as {
      userIds: string[]
      title: string
      message: string
      severity?: 'info' | 'warning' | 'error'
      type?: string
    }

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: 'userIds required' }, { status: 400 })
    }
    if (!message?.trim()) {
      return NextResponse.json({ error: 'message required' }, { status: 400 })
    }

    await Promise.all(
      userIds.map((id) =>
        notifyUser(id, title || 'Notification', message.trim(), severity, type)
      )
    )

    return NextResponse.json({ success: true, count: userIds.length })
  } catch (error) {
    console.error('Send notifications error:', error)
    return NextResponse.json({ error: 'Failed to send notifications' }, { status: 500 })
  }
}
