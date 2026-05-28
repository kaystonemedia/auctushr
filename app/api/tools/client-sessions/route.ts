import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { ClientWorkSession } from '@/types/tools'

type ProfileMetadata = Record<string, unknown>

function getClientSessions(metadata: ProfileMetadata | null): ClientWorkSession[] {
  const tools = metadata?.tools as ProfileMetadata | undefined
  const sessions = tools?.clientSessions as ClientWorkSession[] | undefined
  return Array.isArray(sessions) ? sessions : []
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

    const sessions = getClientSessions((data?.metadata || {}) as ProfileMetadata)
    return NextResponse.json({ success: true, sessions })
  } catch (error) {
    console.error('Client sessions GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessions } = await request.json()
    if (!Array.isArray(sessions)) {
      return NextResponse.json({ error: 'sessions array is required' }, { status: 400 })
    }

    const trimmed = (sessions as ClientWorkSession[]).slice(0, 100)

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
        clientSessions: trimmed,
      },
    }

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ metadata: nextMetadata })
      .eq('id', authResult.user.profileId)

    if (updateError) throw updateError

    const completed = trimmed.filter((s) => s.status === 'completed')
    for (const session of completed.slice(0, 5)) {
      const start = new Date(session.startTime)
      const end = session.endTime ? new Date(session.endTime) : new Date()
      const durationHours = (session.durationMinutes || 0) / 60

      await supabaseAdmin.from('meetings').insert({
        user_id: authResult.user.profileId,
        title: session.clientName,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        duration: durationHours,
        type: session.sessionType,
        notes: session.notes || null,
        tags: session.tags || [],
        status: 'completed',
        outcomes: session.recordingLink ? [{ type: 'recording', url: session.recordingLink }] : [],
      })
    }

    return NextResponse.json({ success: true, count: trimmed.length })
  } catch (error) {
    console.error('Client sessions POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
