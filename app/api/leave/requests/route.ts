import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { mapLeaveRow } from '@/lib/leave-mappers'
import { notifyUser } from '@/lib/notify-user'
import { format } from 'date-fns'

function datesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart <= bEnd && bStart <= aEnd
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const view = searchParams.get('view') || 'all'
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')
    const status = searchParams.get('status')

    let query = supabaseAdmin
      .from('leave_requests')
      .select('*, profiles:employee_id(first_name, last_name, department, email)')
      .order('created_at', { ascending: false })

    if (fromDate) {
      query = query.gte('end_date', fromDate)
    }
    if (toDate) {
      query = query.lte('start_date', toDate)
    }
    if (status) {
      query = query.eq('status', status)
    }

    if (view === 'pending') {
      query = query.eq('status', 'pending')
    } else if (view === 'my') {
      query = query.eq('employee_id', authResult.user.profileId)
    } else if (authResult.user.role === 'manager') {
      const { data: team } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('manager_id', authResult.user.profileId)
      const ids = (team || []).map((t) => t.id)
      if (ids.length > 0) {
        query = query.or(
          `manager_id.eq.${authResult.user.profileId},employee_id.in.(${ids.join(',')})`
        )
      } else {
        query = query.eq('manager_id', authResult.user.profileId)
      }
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({
      requests: (data || []).map((row) => mapLeaveRow(row)),
    })
  } catch (error) {
    console.error('Leave requests GET error:', error)
    return NextResponse.json({ error: 'Failed to load leave requests' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, startDate, endDate, reason, attachments } = body as {
      type: string
      startDate: string
      endDate: string
      reason?: string
      attachments?: string[]
    }

    if (!type || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    if (end < start) {
      return NextResponse.json({ error: 'End date cannot be before start date' }, { status: 400 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (start < today) {
      return NextResponse.json({ error: 'Cannot request leave for past dates' }, { status: 400 })
    }

    const profileId = authResult.user.profileId
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('manager_id, first_name, last_name, department, email')
      .eq('id', profileId)
      .maybeSingle()

    const { data: existing } = await supabaseAdmin
      .from('leave_requests')
      .select('start_date, end_date, status')
      .eq('employee_id', profileId)
      .in('status', ['pending', 'approved'])

    for (const row of existing || []) {
      if (
        datesOverlap(
          start,
          end,
          new Date(row.start_date),
          new Date(row.end_date)
        )
      ) {
        return NextResponse.json(
          { error: 'Your leave dates overlap with an existing request' },
          { status: 409 }
        )
      }
    }

    const year = new Date().getFullYear()
    const balanceId = `${profileId}_${year}`
    const { data: balanceRow } = await supabaseAdmin
      .from('leave_balances')
      .select('*')
      .eq('id', balanceId)
      .maybeSingle()

    const daysRequested =
      Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const available = balanceRow
      ? Number((balanceRow as Record<string, number>)[type] ?? 0)
      : type === 'annual'
        ? 20
        : 0

    if (balanceRow && daysRequested > available) {
      return NextResponse.json(
        { error: `Insufficient ${type} leave balance. Available: ${available} days` },
        { status: 400 }
      )
    }

    const { data: created, error: insertError } = await supabaseAdmin
      .from('leave_requests')
      .insert({
        employee_id: profileId,
        manager_id: profile?.manager_id || null,
        type,
        start_date: start.toISOString().slice(0, 10),
        end_date: end.toISOString().slice(0, 10),
        status: 'pending',
        reason: reason || '',
        attachments: attachments || [],
      })
      .select('*, profiles:employee_id(first_name, last_name, department, email)')
      .single()

    if (insertError) throw insertError

    const dateRange = `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`
    await notifyUser(
      profileId,
      'Leave Request Submitted',
      `Your ${type} leave request for ${dateRange} is pending approval.`,
      'info',
      'leave'
    )

    if (profile?.manager_id) {
      const submitter =
        `${profile.first_name || ''} ${profile.last_name || ''}`.trim() ||
        profile.email ||
        'An employee'
      await notifyUser(
        profile.manager_id,
        'New Leave Request',
        `${submitter} submitted ${type} leave for ${dateRange}.`,
        'info',
        'leave'
      )
    } else {
      const { data: admins } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
      for (const admin of admins || []) {
        await notifyUser(
          admin.id,
          'New Leave Request',
          `A ${type} leave request for ${dateRange} needs approval.`,
          'info',
          'leave'
        )
      }
    }

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: profileId,
      action: 'leave.request',
      entity_type: 'leave_request',
      entity_id: created.id,
      details: { type, startDate, endDate },
    })

    return NextResponse.json({ request: mapLeaveRow(created) })
  } catch (error) {
    console.error('Leave request POST error:', error)
    return NextResponse.json({ error: 'Failed to submit leave request' }, { status: 500 })
  }
}
