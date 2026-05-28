import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { buildProductivityUpsert, toRecordDate } from '@/lib/productivity-records-helpers'

function resolveProfileId(requestedId: string, authProfileId: string, role: string) {
  if (requestedId === authProfileId) return authProfileId
  if (['admin', 'manager'].includes(role)) return requestedId
  return null
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { userId, timestamp, filename, base64Data, metadata } = body

    if (!userId || !timestamp || !filename) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, timestamp, filename' },
        { status: 400 }
      )
    }

    const targetId = resolveProfileId(userId, authResult.user.profileId, authResult.user.role)
    if (!targetId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .or(`id.eq.${targetId},auth_user_id.eq.${targetId}`)
      .maybeSingle()
    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const screenshotPayload = {
      filename,
      activeWindow: metadata?.activeWindow || 'Unknown',
      productivity_score: metadata?.productivity_score || 0,
      hasImageData: Boolean(base64Data),
    }

    const { data: monitoringEvent, error: monitorError } = await supabaseAdmin
      .from('monitoring_events')
      .insert({
        employee_id: profile.id,
        event_type: 'screenshot',
        source: 'electron_app',
        payload: screenshotPayload,
      })
      .select('id')
      .single()
    if (monitorError) throw monitorError

    const score = Number(metadata?.productivity_score || 0)
    await supabaseAdmin.from('productivity_records').upsert(
      buildProductivityUpsert({
        userId: profile.id,
        date: new Date(timestamp),
        score,
        metadata: {
          type: 'screenshot_captured',
          screenshotId: monitoringEvent.id,
          activeWindow: metadata?.activeWindow || 'Unknown',
        },
      }),
      { onConflict: 'user_id,date' }
    )

    return NextResponse.json({
      success: true,
      screenshotId: monitoringEvent.id,
      message: 'Screenshot synced successfully',
    })
  } catch (error) {
    console.error('Error syncing screenshot:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!userId) {
      return NextResponse.json({ error: 'userId parameter is required' }, { status: 400 })
    }

    const targetId = resolveProfileId(userId, authResult.user.profileId, authResult.user.role)
    if (!targetId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .or(`id.eq.${targetId},auth_user_id.eq.${targetId}`)
      .maybeSingle()
    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    let query = supabaseAdmin
      .from('monitoring_events')
      .select('*')
      .eq('employee_id', profile.id)
      .eq('event_type', 'screenshot')
      .order('created_at', { ascending: false })

    if (startDate) query = query.gte('created_at', new Date(startDate).toISOString())
    if (endDate) query = query.lte('created_at', new Date(endDate).toISOString())

    const { data: rows, error } = await query
    if (error) throw error

    const screenshots = (rows || []).map((row) => {
      const payload = (row.payload || {}) as Record<string, unknown>
      return {
        id: row.id,
        ...payload,
        timestamp: payload.timestamp || row.created_at,
        createdAt: row.created_at,
      }
    })

    return NextResponse.json({
      success: true,
      screenshots,
      count: screenshots.length,
    })
  } catch (error) {
    console.error('Error fetching screenshots:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const screenshotId = searchParams.get('screenshotId')
    if (!screenshotId) {
      return NextResponse.json({ error: 'screenshotId parameter is required' }, { status: 400 })
    }

    const { data: event, error: readError } = await supabaseAdmin
      .from('monitoring_events')
      .select('id, employee_id')
      .eq('id', screenshotId)
      .maybeSingle()
    if (readError) throw readError
    if (!event) {
      return NextResponse.json({ error: 'Screenshot not found' }, { status: 404 })
    }

    if (
      event.employee_id !== authResult.user.profileId &&
      !['admin', 'manager'].includes(authResult.user.role)
    ) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const { error: deleteError } = await supabaseAdmin
      .from('monitoring_events')
      .delete()
      .eq('id', screenshotId)
    if (deleteError) throw deleteError

    return NextResponse.json({ success: true, message: 'Screenshot deleted successfully' })
  } catch (error) {
    console.error('Error deleting screenshot:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
