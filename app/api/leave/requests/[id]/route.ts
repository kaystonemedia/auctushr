import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { mapLeaveRow } from '@/lib/leave-mappers'
import { notifyUser } from '@/lib/notify-user'
import { format } from 'date-fns'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['admin', 'manager'].includes(authResult.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    const body = await request.json()
    const status = body.status as 'approved' | 'rejected'
    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const { data: existing } = await supabaseAdmin
      .from('leave_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    if (authResult.user.role === 'manager') {
      const { data: emp } = await supabaseAdmin
        .from('profiles')
        .select('manager_id')
        .eq('id', existing.employee_id)
        .maybeSingle()
      const canApprove =
        existing.manager_id === authResult.user.profileId ||
        emp?.manager_id === authResult.user.profileId
      if (!canApprove) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const now = new Date().toISOString()
    const update =
      status === 'approved'
        ? {
            status: 'approved',
            approved_by: authResult.user.profileId,
            approved_at: now,
            updated_at: now,
          }
        : {
            status: 'rejected',
            rejected_by: authResult.user.profileId,
            rejected_at: now,
            updated_at: now,
          }

    const { data: updated, error } = await supabaseAdmin
      .from('leave_requests')
      .update(update)
      .eq('id', id)
      .select('*, profiles:employee_id(first_name, last_name, department, email)')
      .single()

    if (error) throw error

    const start = new Date(existing.start_date)
    const end = new Date(existing.end_date)
    const dateRange = `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`

    if (status === 'approved') {
      await notifyUser(
        existing.employee_id,
        'Leave Request Approved',
        `Your ${existing.type} leave request for ${dateRange} has been approved.`,
        'info',
        'leave'
      )
    } else {
      await notifyUser(
        existing.employee_id,
        'Leave Request Rejected',
        `Your ${existing.type} leave request for ${dateRange} has been rejected.`,
        'warning',
        'leave'
      )
    }

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: authResult.user.profileId,
      action: `leave.${status}`,
      entity_type: 'leave_request',
      entity_id: id,
      details: { employeeId: existing.employee_id },
    })

    return NextResponse.json({ request: mapLeaveRow(updated) })
  } catch (error) {
    console.error('Leave request PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update leave request' }, { status: 500 })
  }
}
