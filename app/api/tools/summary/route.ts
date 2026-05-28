import { NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { computeProductivityScore } from '@/lib/tools/format'

export async function GET(request: Request) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profileId = authResult.user.profileId
    const today = new Date().toISOString().split('T')[0]
    const start = new Date(`${today}T00:00:00Z`)
    const end = new Date(`${today}T23:59:59Z`)

    const { data: assigneeLinks } = await supabaseAdmin
      .from('task_assignees')
      .select('task_id')
      .eq('assignee_id', profileId)

    const taskIds = (assigneeLinks || []).map((link) => link.task_id)
    let taskStats = { received: 0, pending: 0, completed: 0 }

    if (taskIds.length > 0) {
      const { data: tasks } = await supabaseAdmin
        .from('tasks')
        .select('id, status, created_at')
        .in('id', taskIds)

      const rows = tasks || []
      taskStats = {
        received: rows.length,
        pending: rows.filter((t) => ['pending', 'backlog', 'accepted', 'in_progress'].includes(t.status)).length,
        completed: rows.filter((t) => t.status === 'completed').length,
      }
    }

    const { data: events } = await supabaseAdmin
      .from('monitoring_events')
      .select('event_type, payload, created_at')
      .eq('employee_id', profileId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())

    const eventRows = events || []
    const screenshotsCount = eventRows.filter((e) => e.event_type === 'screenshot').length
    const activitiesCount = eventRows.filter((e) => e.event_type === 'activity').length

    let sessionDurationMs = 0
    let idleDurationMs = 0
    const workSessionEvent = eventRows
      .filter((e) => e.event_type === 'work_session')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

    if (workSessionEvent?.payload && typeof workSessionEvent.payload === 'object') {
      const payload = workSessionEvent.payload as Record<string, number>
      sessionDurationMs = payload.sessionDurationMs || 0
      idleDurationMs = payload.idleDurationMs || 0
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('metadata')
      .eq('id', profileId)
      .maybeSingle()

    const metadata = (profile?.metadata || {}) as Record<string, unknown>
    const tools = (metadata.tools || {}) as Record<string, unknown>
    const clientSessions = (tools.clientSessions || []) as Array<{
      status?: string
      durationMinutes?: number
    }>

    const clientWorkMinutes = clientSessions
      .filter((s) => s.status === 'completed')
      .reduce((sum, s) => sum + (s.durationMinutes || 0), 0)

    const activeTimeMs = Math.max(0, sessionDurationMs - idleDurationMs)
    const productivityScore = computeProductivityScore(
      activeTimeMs,
      sessionDurationMs || activeTimeMs + clientWorkMinutes * 60 * 1000,
      clientWorkMinutes * 60 * 1000
    )

    return NextResponse.json({
      success: true,
      taskStats,
      activity: {
        activeTimeMs,
        idleTimeMs: idleDurationMs,
        totalTimeMs: sessionDurationMs,
        screenshotsCount,
        activitiesCount,
        productivityScore,
        clientWorkMinutes,
      },
      lastMonitoringSync: metadata.lastMonitoringSync || null,
      lastToolsSync: metadata.lastToolsSync || null,
    })
  } catch (error) {
    console.error('Tools summary error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
