import { NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = authResult.user.profileId

    const { type, data, timestamp } = await request.json()

    if (!type || !userId) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: userId,
        type: 'custom',
        title: `Productivity: ${type}`,
        message: `Productivity event: ${type}`,
        severity: 'info',
        read: false,
        data: {
          eventType: type,
          ...data,
          timestamp: timestamp || new Date().toISOString()
        }
      })

    if (error) {
      throw error
    }

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: authResult.user.profileId,
      action: 'notifications.productivity',
      entity_type: 'notification',
      details: {
        type,
        targetUserId: userId,
        payload: {
          ...data,
          timestamp: timestamp || new Date().toISOString()
        }
      }
    })

    return NextResponse.json({
      success: true,
      notification: {
        type,
        userId,
        payload: {
      ...data,
      timestamp: timestamp || new Date().toISOString()
        }
      }
    })
  } catch (error) {
    console.error('Error processing productivity notification:', error)
    return NextResponse.json(
      { error: 'Failed to process notification' },
      { status: 500 }
    )
  }
} 