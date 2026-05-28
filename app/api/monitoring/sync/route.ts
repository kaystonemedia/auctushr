import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const employeeId = authResult.user.profileId
    const { screenshots, activityData, syncTime } = await request.json()
    const screenshotRows = Array.isArray(screenshots) ? screenshots : []
    const activityRows = Array.isArray(activityData) ? activityData : []

    if (screenshotRows.length > 0) {
      const payload = screenshotRows.map((screenshot: Record<string, unknown>) => ({
        employee_id: employeeId,
        event_type: 'screenshot',
        source: 'electron_app',
        payload: screenshot,
      }))
      await supabaseAdmin.from('monitoring_events').insert(payload)
    }

    if (activityRows.length > 0) {
      const payload = activityRows.map((activity: Record<string, unknown>) => ({
        employee_id: employeeId,
        event_type: 'activity',
        source: 'electron_app',
        payload: activity,
      }))
      await supabaseAdmin.from('monitoring_events').insert(payload)
    }

    const { data: currentProfile } = await supabaseAdmin
      .from('profiles')
      .select('metadata')
      .eq('id', employeeId)
      .maybeSingle()
    await supabaseAdmin
      .from('profiles')
      .update({
        metadata: {
          ...((currentProfile?.metadata || {}) as Record<string, unknown>),
          lastMonitoringSync: syncTime,
        },
      })
      .eq('id', employeeId)

    return NextResponse.json({
      success: true,
      syncedScreenshots: screenshotRows.length,
      syncedActivity: activityRows.length,
    })
  } catch (error) {
    console.error('Monitoring sync error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const employeeId = authResult.user.profileId
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
    const limit = parseInt(searchParams.get('limit') || '50')

    const start = new Date(`${date}T00:00:00Z`)
    const end = new Date(`${date}T23:59:59Z`)
    const { data: events, error: eventsError } = await supabaseAdmin
      .from('monitoring_events')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false })
      .limit(limit * 3)
    if (eventsError) throw eventsError

    const screenshots = (events || [])
      .filter((event) => event.event_type === 'screenshot')
      .slice(0, limit)
      .map((event) => {
        const payload = (event.payload || {}) as Record<string, unknown>
        return {
          id: event.id,
          ...payload,
          timestamp: payload.timestamp || event.created_at,
        }
      })

    const activities = (events || [])
      .filter((event) => event.event_type !== 'screenshot')
      .slice(0, limit * 2)
      .map((event) => {
        const payload = (event.payload || {}) as Record<string, unknown>
        return {
          id: event.id,
          ...payload,
          timestamp: payload.timestamp || event.created_at,
        }
      })

    return NextResponse.json({
      success: true,
      data: {
        screenshots,
        activities,
        date,
        total: {
          screenshots: screenshots.length,
          activities: activities.length,
        },
      },
    })
  } catch (error) {
    console.error('Monitoring data fetch error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
