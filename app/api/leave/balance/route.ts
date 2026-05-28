import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { defaultLeaveBalance, mapBalanceRow } from '@/lib/leave-mappers'

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const year = Number(searchParams.get('year') || new Date().getFullYear())
    let employeeId = searchParams.get('employeeId') || authResult.user.profileId

    if (
      employeeId !== authResult.user.profileId &&
      !['admin', 'manager'].includes(authResult.user.role)
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (authResult.user.role === 'manager' && employeeId !== authResult.user.profileId) {
      const { data: emp } = await supabaseAdmin
        .from('profiles')
        .select('manager_id')
        .eq('id', employeeId)
        .maybeSingle()
      if (emp?.manager_id !== authResult.user.profileId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const balanceId = `${employeeId}_${year}`
    const { data: row } = await supabaseAdmin
      .from('leave_balances')
      .select('*')
      .eq('id', balanceId)
      .maybeSingle()

    if (row) {
      return NextResponse.json({ balance: mapBalanceRow(row) })
    }

    const defaults = defaultLeaveBalance(employeeId, year)
    const { data: created, error } = await supabaseAdmin
      .from('leave_balances')
      .insert({
        id: balanceId,
        employee_id: employeeId,
        year,
        annual: defaults.annual,
        sick: defaults.sick,
        personal: defaults.personal,
        maternity: defaults.maternity,
        paternity: defaults.paternity,
        bereavement: defaults.bereavement,
        unpaid: defaults.unpaid,
      })
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json({ balance: mapBalanceRow(created) })
  } catch (error) {
    console.error('Leave balance GET error:', error)
    return NextResponse.json({ error: 'Failed to load leave balance' }, { status: 500 })
  }
}
