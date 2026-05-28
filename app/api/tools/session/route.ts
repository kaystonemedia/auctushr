import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { ToolsWorkSession } from '@/types/tools'

type ProfileMetadata = Record<string, unknown>

function getToolsSession(metadata: ProfileMetadata | null): ToolsWorkSession | null {
  const tools = metadata?.tools as ProfileMetadata | undefined
  const session = tools?.workSession as ToolsWorkSession | undefined
  return session || null
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('metadata')
      .eq('id', authResult.user.profileId)
      .maybeSingle()

    if (error) throw error

    const metadata = (data?.metadata || {}) as ProfileMetadata
    return NextResponse.json({
      success: true,
      session: getToolsSession(metadata),
      lastMonitoringSync: metadata.lastMonitoringSync || null,
    })
  } catch (error) {
    console.error('Tools session GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const session = body.session as ToolsWorkSession
    if (!session) {
      return NextResponse.json({ error: 'session is required' }, { status: 400 })
    }

    const { data: currentProfile, error: readError } = await supabaseAdmin
      .from('profiles')
      .select('metadata')
      .eq('id', authResult.user.profileId)
      .maybeSingle()

    if (readError) throw readError

    const metadata = (currentProfile?.metadata || {}) as ProfileMetadata
    const tools = (metadata.tools as ProfileMetadata) || {}

    const nextMetadata = {
      ...metadata,
      tools: {
        ...tools,
        workSession: {
          ...session,
          updatedAt: new Date().toISOString(),
        },
      },
      lastToolsSync: new Date().toISOString(),
    }

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ metadata: nextMetadata })
      .eq('id', authResult.user.profileId)

    if (updateError) throw updateError

    if (session.isMonitoring) {
      await supabaseAdmin.from('monitoring_events').insert({
        employee_id: authResult.user.profileId,
        event_type: 'work_session',
        source: 'web_app',
        payload: {
          isMonitoring: session.isMonitoring,
          isOnBreak: session.isOnBreak,
          sessionStart: session.sessionStart,
          breakDurationMs: session.breakDurationMs,
          sessionDurationMs: session.sessionDurationMs,
          idleDurationMs: session.idleDurationMs,
        },
      })
    }

    return NextResponse.json({ success: true, syncedAt: nextMetadata.lastToolsSync })
  } catch (error) {
    console.error('Tools session POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
