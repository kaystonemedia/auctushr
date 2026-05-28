import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

function mapPayrollEntry(row: Record<string, unknown>, profile?: { first_name?: string; last_name?: string; department?: string }) {
  const allowances = (row.allowances as unknown[]) || []
  const deductions = (row.deductions as unknown[]) || []
  const payment = (row.payment as Record<string, unknown>) || {}
  const name = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
    : ''

  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: name || payment.employeeName || 'Unknown',
    departmentId: row.department_id,
    department: profile?.department || payment.department || 'Unassigned',
    periodId: row.period_month,
    period: row.period_month,
    basicSalary: Number(row.basic_salary || 0),
    grossSalary: Number(row.gross_salary || 0),
    netSalary: Number(row.net_salary || 0),
    allowances,
    deductions,
    overtimeHours: Number(row.overtime_hours || 0),
    overtimeRate: Number(row.overtime_rate || 1),
    bonus: Number(row.bonus || 0),
    status: row.status,
    paymentDate: row.payment_date ? new Date(row.payment_date as string) : null,
    paymentMethod: row.payment_method,
    payment,
    notes: row.notes,
    createdAt: row.created_at ? new Date(row.created_at as string) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at as string) : null,
    processedAt: row.updated_at ? new Date(row.updated_at as string) : null,
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['admin', 'manager'].includes(authResult.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const periodMonth = searchParams.get('periodMonth')
    const employeeId = searchParams.get('employeeId')
    const hasPayment = searchParams.get('hasPayment') === 'true'

    let query = supabaseAdmin
      .from('payroll_entries')
      .select('*, profiles:employee_id(first_name, last_name, department)')
      .order('updated_at', { ascending: false })

    if (periodMonth) query = query.eq('period_month', periodMonth)
    if (employeeId) query = query.eq('employee_id', employeeId)

    if (authResult.user.role === 'manager') {
      const { data: team } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('manager_id', authResult.user.profileId)
      const ids = (team || []).map((t) => t.id)
      if (ids.length > 0) query = query.in('employee_id', ids)
      else return NextResponse.json({ entries: [] })
    }

    const { data, error } = await query.limit(500)
    if (error) throw error

    let rows = data || []
    if (hasPayment) {
      rows = rows.filter((row) => {
        const payment = row.payment as Record<string, unknown> | null
        return payment && Object.keys(payment).length > 0
      })
    }

    const entries = rows.map((row) =>
      mapPayrollEntry(
        row as Record<string, unknown>,
        row.profiles as { first_name?: string; last_name?: string; department?: string }
      )
    )

    const periods = [...new Set(entries.map((e) => e.period).filter(Boolean))]

    return NextResponse.json({ entries, periods })
  } catch (error) {
    console.error('Payroll entries GET error:', error)
    return NextResponse.json({ error: 'Failed to load payroll entries' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (authResult.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      employeeId,
      periodMonth,
      basicSalary,
      grossSalary,
      netSalary,
      allowances,
      deductions,
      overtimeHours,
      bonus,
      notes,
      departmentId,
      status,
    } = body

    if (!employeeId || !periodMonth) {
      return NextResponse.json({ error: 'employeeId and periodMonth are required' }, { status: 400 })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('first_name, last_name, department, department_id, salary')
      .eq('id', employeeId)
      .maybeSingle()

    const gross = grossSalary ?? profile?.salary ?? basicSalary ?? 0
    const net = netSalary ?? gross

    const { data, error } = await supabaseAdmin
      .from('payroll_entries')
      .insert({
        employee_id: employeeId,
        department_id: departmentId || profile?.department_id || null,
        period_month: periodMonth,
        basic_salary: basicSalary ?? gross,
        gross_salary: gross,
        net_salary: net,
        allowances: allowances || [],
        deductions: deductions || [],
        overtime_hours: overtimeHours || 0,
        bonus: bonus || 0,
        status: status || 'processed',
        notes: notes || null,
        payment: {
          processedBy: authResult.user.profileId,
          employeeName: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(),
          department: profile?.department,
        },
      })
      .select('*, profiles:employee_id(first_name, last_name, department)')
      .single()

    if (error) throw error

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: authResult.user.profileId,
      action: 'payroll.process',
      entity_type: 'payroll_entry',
      entity_id: data.id,
      details: { employeeId, periodMonth },
    })

    return NextResponse.json({
      entry: mapPayrollEntry(
        data as Record<string, unknown>,
        data.profiles as { first_name?: string; last_name?: string; department?: string }
      ),
    })
  } catch (error) {
    console.error('Payroll entries POST error:', error)
    return NextResponse.json({ error: 'Failed to create payroll entry' }, { status: 500 })
  }
}
