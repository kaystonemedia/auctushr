import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// GET /api/notifications - Get user notifications
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unreadOnly') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')

    let query = supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', authResult.user.profileId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (unreadOnly) {
      query = query.eq('read', false)
    }

    const { data, error } = await query
    if (error) {
      throw error
    }

    const notifications = (data || []).map((item) => ({
      ...item,
      createdAt: item.created_at ? new Date(item.created_at) : null
    }))

    return NextResponse.json({ notifications })
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
  }
}

// PUT /api/notifications?id=<notificationId> - Mark notification as read
export async function PUT(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const notificationId = searchParams.get('id')
    if (!notificationId) {
      return NextResponse.json({ error: 'Notification id is required' }, { status: 400 })
    }

    const { data: notificationData, error: readError } = await supabaseAdmin
      .from('notifications')
      .select('id, user_id')
      .eq('id', notificationId)
      .maybeSingle()
    if (readError) {
      throw readError
    }
    if (!notificationData) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }
    if (notificationData.user_id !== authResult.user.profileId) {
      return NextResponse.json({ error: 'Not authorized to update this notification' }, { status: 403 })
    }

    const { error: updateError } = await supabaseAdmin
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
    if (updateError) {
      throw updateError
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error marking notification as read:', error)
    return NextResponse.json({ error: 'Failed to mark notification as read' }, { status: 500 })
  }
}

// POST /api/notifications/read-all - Mark all notifications as read
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: unreadRows, error: unreadError } = await supabaseAdmin
      .from('notifications')
      .select('id')
      .eq('user_id', authResult.user.profileId)
      .eq('read', false)
    if (unreadError) {
      throw unreadError
    }

    const ids = (unreadRows || []).map((row) => row.id)
    if (ids.length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('notifications')
        .update({ read: true })
        .in('id', ids)
      if (updateError) {
        throw updateError
      }
    }

    return NextResponse.json({ 
      success: true, 
      updatedCount: ids.length
    })
  } catch (error) {
    console.error('Error marking all notifications as read:', error)
    return NextResponse.json({ error: 'Failed to mark all notifications as read' }, { status: 500 })
  }
}

// DELETE /api/notifications?id=<notificationId> - Delete notification
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const notificationId = searchParams.get('id')
    if (!notificationId) {
      return NextResponse.json({ error: 'Notification id is required' }, { status: 400 })
    }

    const { data: notificationData, error: readError } = await supabaseAdmin
      .from('notifications')
      .select('id, user_id')
      .eq('id', notificationId)
      .maybeSingle()
    if (readError) {
      throw readError
    }
    if (!notificationData) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }
    if (notificationData.user_id !== authResult.user.profileId) {
      return NextResponse.json({ error: 'Not authorized to delete this notification' }, { status: 403 })
    }

    const { error: deleteError } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('id', notificationId)
    if (deleteError) {
      throw deleteError
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting notification:', error)
    return NextResponse.json({ error: 'Failed to delete notification' }, { status: 500 })
  }
}

