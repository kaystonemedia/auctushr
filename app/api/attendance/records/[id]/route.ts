import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const body = await request.json()

    const { data: record } = await supabaseAdmin
      .from('attendance_records')
      .select('employee_id')
      .eq('id', id)
      .maybeSingle()

    if (!record) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }

    const isOwner = record.employee_id === authResult.user!.profileId
    const isManager = ['admin', 'manager'].includes(authResult.user!.role)
    if (!isOwner && !isManager) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const update: Record<string, unknown> = {}
    if (body.idleTimeMinutes !== undefined) update.idle_time_minutes = body.idleTimeMinutes
    if (body.activeTimeMinutes !== undefined) update.active_time_minutes = body.activeTimeMinutes
    if (body.flags !== undefined) update.flags = body.flags

    const { error } = await supabaseAdmin.from('attendance_records').update(update).eq('id', id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Attendance PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update record' }, { status: 500 })
  }
}
