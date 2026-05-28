import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { SettingsService } from '@/lib/settings'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { mapAttendanceRowToClient, type AttendanceRow } from '@/lib/attendance-mappers'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { location, deviceInfo, idleTimeMinutes } = body as {
      location?: Record<string, unknown>
      deviceInfo?: Record<string, unknown>
      idleTimeMinutes?: number
    }

    const { data: existing, error: readError } = await supabaseAdmin
      .from('attendance_records')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (readError) throw readError
    if (!existing) {
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 })
    }

    if (
      existing.employee_id !== authResult.user.profileId &&
      !['admin', 'manager'].includes(authResult.user.role)
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (existing.check_out_time) {
      return NextResponse.json({ error: 'You have already checked out today.' }, { status: 409 })
    }

    const checkInTime = existing.check_in_time ? new Date(existing.check_in_time) : new Date()
    const checkOutTime = new Date()
    const workDurationMs = checkOutTime.getTime() - checkInTime.getTime()
    const totalHours = Math.max(0, workDurationMs / (1000 * 60 * 60))
    const totalMinutes = Math.max(0, workDurationMs / (1000 * 60))
    const idle = Number(idleTimeMinutes ?? existing.idle_time_minutes ?? 0)
    const activeTimeMinutes = Math.max(0, totalMinutes - idle)

    let slaThreshold = 3
    try {
      const settings = await SettingsService.getInstance().getSettings()
      slaThreshold = settings.attendance.idleTimeSLAThreshold || 3
    } catch {
      /* use default */
    }

    let status = existing.status || 'present'
    if (totalHours < 4) status = 'half_day'
    else if (totalHours < 8) status = 'early_leave'

    const updatePayload: Record<string, unknown> = {
      check_out_time: checkOutTime.toISOString(),
      check_out_location: location || null,
      check_out_device: deviceInfo || null,
      total_hours: Number(totalHours.toFixed(2)),
      active_time_minutes: Math.round(activeTimeMinutes),
      idle_time_minutes: idle,
      status,
      updated_at: checkOutTime.toISOString(),
    }

    if (idle > slaThreshold) {
      updatePayload.notes = `Idle SLA exceeded (${idle}m > ${slaThreshold}m)`
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('attendance_records')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single()

    if (updateError) throw updateError

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: authResult.user.profileId,
      action: 'attendance.check_out',
      entity_type: 'attendance',
      entity_id: id,
      details: { totalHours, activeTimeMinutes },
    })

    return NextResponse.json({
      record: mapAttendanceRowToClient(updated as AttendanceRow),
    })
  } catch (error) {
    console.error('Attendance check-out error:', error)
    return NextResponse.json({ error: 'Failed to check out' }, { status: 500 })
  }
}
