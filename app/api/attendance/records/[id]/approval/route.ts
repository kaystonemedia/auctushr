import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
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
    const { action, notes } = body as { action: 'approved' | 'rejected'; notes?: string }

    if (!['approved', 'rejected'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const { data: record, error: fetchError } = await supabaseAdmin
      .from('attendance_records')
      .select('id, manager_id, employee_id')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!record) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }

    if (
      authResult.user.role === 'manager' &&
      record.manager_id !== authResult.user.profileId
    ) {
      const { data: emp } = await supabaseAdmin
        .from('profiles')
        .select('manager_id')
        .eq('id', record.employee_id)
        .maybeSingle()
      if (emp?.manager_id !== authResult.user.profileId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from('attendance_records')
      .update({
        approval_status: action,
        approved_by: authResult.user.profileId,
        approved_at: new Date().toISOString(),
        notes: notes || null,
      })
      .eq('id', id)

    if (updateError) throw updateError

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Attendance approval error:', error)
    return NextResponse.json({ error: 'Failed to update approval' }, { status: 500 })
  }
}
