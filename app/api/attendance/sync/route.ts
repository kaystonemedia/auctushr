import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { rateLimit } from '@/lib/rate-limit'
import { SettingsService } from '@/lib/settings'
import { supabaseAdmin } from '@/lib/supabase/admin'

interface ActivityEntry {
  type?: string
  time?: string
  location?: unknown
  deviceInfo?: unknown
}

interface AttendanceSyncSession {
  startTime?: string
  activities?: ActivityEntry[]
  idleTime?: number
  activeTime?: number
  isCheckOut?: boolean
  checkInLocation?: unknown
  deviceInfo?: unknown
}

async function writeAuditLog(action: string, payload: Record<string, unknown>) {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      action,
      entity_type: 'attendance',
      details: payload
    })
  } catch (auditError) {
    console.error('Failed to persist audit log:', auditError)
  }
}

async function resolveTargetProfileId(
  actingUser: { uid: string; role: 'admin' | 'manager' | 'employee'; profileId: string },
  requestedUserId: string
) {
  if (requestedUserId === actingUser.uid || requestedUserId === actingUser.profileId) {
    return actingUser.profileId
  }

  if (actingUser.role !== 'admin' && actingUser.role !== 'manager') {
    return null
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, auth_user_id')
    .or(`id.eq.${requestedUserId},auth_user_id.eq.${requestedUserId}`)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data.id as string
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit attendance sync (can be called frequently)
    const rateLimitResponse = await rateLimit({
      windowMs: 60000, // 1 minute
      maxRequests: 30, // 30 syncs per minute per IP
    })(request)
    if (rateLimitResponse) {
      return rateLimitResponse
    }
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error
    }

    const { session: activitySession, userId } = await request.json()
    if (!activitySession || !userId) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const targetProfileId = await resolveTargetProfileId(authResult.user, userId)
    if (!targetProfileId) {
      return NextResponse.json({ error: 'Forbidden - userId mismatch' }, { status: 403 })
    }

    const {
      startTime,
      activities,
      idleTime,
      activeTime,
      isCheckOut,
      checkInLocation,
      deviceInfo
    } = activitySession as AttendanceSyncSession

    const syncDate = startTime ? new Date(startTime) : new Date()
    const attendanceDate = syncDate.toISOString().slice(0, 10)

    // Pull current profile context once for status/manager updates.
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, manager_id')
      .eq('id', targetProfileId)
      .maybeSingle()

    if (profileError || !profileData) {
      return NextResponse.json({ error: 'Employee profile not found' }, { status: 404 })
    }

    const { data: existingAttendance, error: attendanceFetchError } = await supabaseAdmin
      .from('attendance_records')
      .select('*')
      .eq('employee_id', targetProfileId)
      .eq('date', attendanceDate)
      .maybeSingle()

    if (attendanceFetchError) {
      throw attendanceFetchError
    }

    if (!existingAttendance) {
      const insertPayload = {
        employee_id: targetProfileId,
        manager_id: profileData.manager_id || null,
        date: attendanceDate,
        status: 'present',
        check_in_time: startTime ? new Date(startTime).toISOString() : new Date().toISOString(),
        check_in_location: checkInLocation || null,
        check_in_device: deviceInfo || null,
        idle_time_minutes: idleTime || 0,
        active_time_minutes: activeTime || 0,
        approval_status: 'pending',
        notes: null,
        flags: []
      }

      const { data: createdRecord, error: insertError } = await supabaseAdmin
        .from('attendance_records')
        .insert(insertPayload)
        .select('id')
        .single()

      if (insertError) {
        throw insertError
      }

      await writeAuditLog('attendance.check_in', {
        actorProfileId: authResult.user.profileId,
        targetProfileId,
        attendanceId: createdRecord.id,
        startTime
      })
    } else {
      const previousIdle = Number(existingAttendance.idle_time_minutes || 0)
      const previousActive = Number(existingAttendance.active_time_minutes || 0)
      const mergedIdle = previousIdle + Number(idleTime || 0)
      const mergedActive = previousActive + Number(activeTime || 0)

      const checkInTime = existingAttendance.check_in_time
        ? new Date(existingAttendance.check_in_time)
        : startTime
          ? new Date(startTime)
          : new Date()

      const checkOutActivity = (activities || []).find((a) => a.type === 'check_out')
      const checkOutTime = isCheckOut && checkOutActivity?.time
        ? new Date(checkOutActivity.time)
        : new Date()

      const workDurationMs = checkOutTime.getTime() - checkInTime.getTime()
      const totalHours = Math.max(0, workDurationMs / (1000 * 60 * 60))
      const totalMinutes = Math.max(0, workDurationMs / (1000 * 60))
      const activeTimeMinutes = Math.max(0, totalMinutes - mergedIdle)

      let slaThreshold = 3
      try {
        const settingsService = SettingsService.getInstance()
        const settings = await settingsService.getSettings()
        slaThreshold = settings.attendance.idleTimeSLAThreshold || 3
      } catch (error) {
        console.error('Error fetching settings for SLA threshold:', error)
      }

      const updatePayload: Record<string, unknown> = {
        idle_time_minutes: mergedIdle,
        active_time_minutes: mergedActive,
        total_hours: totalHours,
        flags: existingAttendance.flags || []
      }

      if (isCheckOut && checkOutActivity?.time) {
        updatePayload.check_out_time = new Date(checkOutActivity.time).toISOString()
        updatePayload.check_out_location = checkOutActivity.location || null
        updatePayload.check_out_device = checkOutActivity.deviceInfo || null
      }

      if (mergedIdle > slaThreshold) {
        updatePayload.notes = `Idle SLA exceeded (${mergedIdle}m > ${slaThreshold}m)`
      }

      if (isCheckOut) {
        if (totalHours < 4) {
          updatePayload.status = 'half_day'
        } else if (totalHours < 8) {
          updatePayload.status = 'early_leave'
        }
      }

      const { error: updateError } = await supabaseAdmin
        .from('attendance_records')
        .update(updatePayload)
        .eq('id', existingAttendance.id)

      if (updateError) {
        throw updateError
      }

      await writeAuditLog(isCheckOut ? 'attendance.check_out' : 'attendance.sync', {
        actorProfileId: authResult.user.profileId,
        targetProfileId,
        attendanceId: existingAttendance.id,
        isCheckOut: !!isCheckOut,
        activeTimeMinutes
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error syncing attendance:', error)
    await writeAuditLog('attendance.sync', {
      outcome: 'failure',
      error: error instanceof Error ? error.message : String(error)
    })
    return NextResponse.json(
      { error: 'Failed to sync attendance data' },
      { status: 500 }
    )
  }
}