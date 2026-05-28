import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { mapAttendanceRowToClient, todayDateString, type AttendanceRow } from '@/lib/attendance-mappers'

async function resolveTargetProfileId(
  acting: { profileId: string; uid: string; role: string },
  requested?: string | null
) {
  const id = requested || acting.profileId
  if (id === acting.profileId || id === acting.uid) return acting.profileId
  if (!['admin', 'manager'].includes(acting.role)) return null

  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .or(`id.eq.${id},auth_user_id.eq.${id}`)
    .maybeSingle()
  return data?.id || null
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')
    const employeeId = searchParams.get('employeeId')

    const targetId = await resolveTargetProfileId(authResult.user, employeeId)
    if (!targetId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let query = supabaseAdmin.from('attendance_records').select('*').order('date', { ascending: false })

    if (date) {
      query = query.eq('date', date)
    } else if (fromDate) {
      query = query.gte('date', fromDate)
      if (toDate) query = query.lte('date', toDate)
    } else if (!fromDate && !toDate && employeeId) {
      const d = new Date()
      d.setDate(d.getDate() - 90)
      query = query.gte('date', d.toISOString().slice(0, 10))
    } else if (!fromDate && !toDate) {
      query = query.eq('date', todayDateString())
    }

    if (employeeId || authResult.user.role === 'employee') {
      query = query.eq('employee_id', targetId)
    } else if (authResult.user.role === 'manager') {
      const { data: team } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('manager_id', authResult.user.profileId)
      const ids = (team || []).map((p) => p.id)
      if (ids.length > 0) {
        query = query.in('employee_id', ids)
      } else {
        return NextResponse.json({ records: [], todayRecord: null, date: date || todayDateString() })
      }
    }

    const { data, error } = await query.limit(200)
    if (error) throw error

    const records = (data || []).map((row) => mapAttendanceRowToClient(row as AttendanceRow))
    const today = todayDateString()
    const todayRecord =
      records.find((r) => r.employeeId === authResult.user!.profileId && r.date === today) ||
      records.find((r) => r.employeeId === targetId && (!date || r.date === date)) ||
      null

    return NextResponse.json({ records, todayRecord, date: date || today })
  } catch (error) {
    console.error('Attendance records GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      location,
      deviceInfo,
      employeeName,
      department,
    } = body as {
      location?: Record<string, unknown>
      deviceInfo?: Record<string, unknown>
      employeeName?: string
      department?: string
    }

    const profileId = authResult.user.profileId
    const date = todayDateString()

    const { data: existing } = await supabaseAdmin
      .from('attendance_records')
      .select('id, check_out_time')
      .eq('employee_id', profileId)
      .eq('date', date)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'You have already checked in today.' },
        { status: 409 }
      )
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('manager_id, first_name, last_name, department')
      .eq('id', profileId)
      .maybeSingle()

    const now = new Date().toISOString()
    const { data: created, error: insertError } = await supabaseAdmin
      .from('attendance_records')
      .insert({
        employee_id: profileId,
        employee_name:
          employeeName ||
          `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() ||
          authResult.user.profileId,
        department: department || profile?.department || authResult.user.department || null,
        manager_id: profile?.manager_id || null,
        date,
        status: 'present',
        check_in_time: now,
        check_in_location: location || null,
        check_in_device: deviceInfo || null,
        idle_time_minutes: 0,
        active_time_minutes: 0,
        approval_status: 'pending',
        flags: [],
      })
      .select('*')
      .single()

    if (insertError) throw insertError

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: profileId,
      action: 'attendance.check_in',
      entity_type: 'attendance',
      entity_id: created.id,
      details: { date },
    })

    return NextResponse.json({
      record: mapAttendanceRowToClient(created as AttendanceRow),
    })
  } catch (error) {
    console.error('Attendance check-in error:', error)
    return NextResponse.json({ error: 'Failed to check in' }, { status: 500 })
  }
}
