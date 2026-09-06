import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getBiweeklyPeriodForDate, periodStartDateString, periodEndDateString } from '@/lib/pay-periods'

type EntryProfile = {
  first_name?: string
  last_name?: string
  department?: string
  position?: string
  employee_code?: string
  ssnit_number?: string
  bank_account?: Record<string, unknown> | null
}

function mapPayrollEntry(row: Record<string, unknown>, profile?: EntryProfile) {
  const allowances = (row.allowances as unknown[]) || []
  const deductions = (row.deductions as unknown[]) || []
  const payment = (row.payment as Record<string, unknown>) || {}
  const name = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
    : ''
  // period_month is legacy display-only; period_start_date/period_end_date are the source of truth.
  const periodLabel = (row.period_start_date as string) || (row.period_month as string)

  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeCode: profile?.employee_code || null,
    employeeName: name || payment.employeeName || 'Unknown',
    position: profile?.position || null,
    ssnitNumber: profile?.ssnit_number || null,
    bankAccount: profile?.bank_account || null,
    departmentId: row.department_id,
    department: profile?.department || payment.department || 'Unassigned',
    periodId: periodLabel,
    period: periodLabel,
    periodStartDate: row.period_start_date || null,
    periodEndDate: row.period_end_date || null,
    payFrequency: row.pay_frequency || 'biweekly',
    daysWorked: row.days_worked != null ? Number(row.days_worked) : null,
    daysAbsent: row.days_absent != null ? Number(row.days_absent) : null,
    currency: row.currency || 'GHS',
    exchangeRate: row.exchange_rate != null ? Number(row.exchange_rate) : null,
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
    const periodStart = searchParams.get('periodStart')
    const periodEnd = searchParams.get('periodEnd')
    const employeeId = searchParams.get('employeeId')
    const hasPayment = searchParams.get('hasPayment') === 'true'

    let query = supabaseAdmin
      .from('payroll_entries')
      .select('*, profiles:employee_id(employee_code, first_name, last_name, department, position, ssnit_number, bank_account)')
      .order('updated_at', { ascending: false })

    // period_month is legacy-only; new callers should filter by periodStart/periodEnd.
    if (periodMonth) query = query.eq('period_month', periodMonth)
    if (periodStart) query = query.gte('period_start_date', periodStart)
    if (periodEnd) query = query.lte('period_end_date', periodEnd)
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
      mapPayrollEntry(row as Record<string, unknown>, row.profiles as EntryProfile)
    )

    // Legacy flat list (distinct period keys) kept for older callers.
    const periods = [...new Set(entries.map((e) => e.period).filter(Boolean))]

    // Richer period objects so the UI can render a real date-range label
    // instead of guessing one back from a bare key.
    const periodDetails = Array.from(
      new Map(
        entries.map((e) => [
          e.period,
          {
            key: e.period,
            periodStartDate: e.periodStartDate,
            periodEndDate: e.periodEndDate,
            payFrequency: e.payFrequency
          }
        ])
      ).values()
    ).filter((p) => p.key)

    return NextResponse.json({ entries, periods, periodDetails })
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
      periodStartDate,
      periodEndDate,
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

    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId is required' }, { status: 400 })
    }
    if (!periodStartDate && !periodEndDate && !periodMonth) {
      return NextResponse.json({ error: 'periodStartDate/periodEndDate (or legacy periodMonth) are required' }, { status: 400 })
    }

    // Prefer explicit biweekly bounds; fall back to today's biweekly period, or
    // a legacy periodMonth-derived range if that's all the caller sent.
    let startDateStr = periodStartDate as string | undefined
    let endDateStr = periodEndDate as string | undefined
    let payFrequency: 'biweekly' | 'monthly_legacy' = 'biweekly'
    if (!startDateStr || !endDateStr) {
      if (periodMonth) {
        const [year, month] = String(periodMonth).split('-').map(Number)
        startDateStr = `${periodMonth}-01`
        endDateStr = periodEndDateString({ start: new Date(year, month - 1, 1), end: new Date(year, month, 0) })
        payFrequency = 'monthly_legacy'
      } else {
        const period = getBiweeklyPeriodForDate(new Date())
        startDateStr = periodStartDateString(period)
        endDateStr = periodEndDateString(period)
      }
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
        period_month: payFrequency === 'monthly_legacy' ? periodMonth : null,
        period_start_date: startDateStr,
        period_end_date: endDateStr,
        pay_frequency: payFrequency,
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
      .select('*, profiles:employee_id(employee_code, first_name, last_name, department, position, ssnit_number, bank_account)')
      .single()

    if (error) throw error

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: authResult.user.profileId,
      action: 'payroll.process',
      entity_type: 'payroll_entry',
      entity_id: data.id,
      details: { employeeId, periodStartDate: startDateStr, periodEndDate: endDateStr },
    })

    return NextResponse.json({
      entry: mapPayrollEntry(data as Record<string, unknown>, data.profiles as EntryProfile),
    })
  } catch (error) {
    console.error('Payroll entries POST error:', error)
    return NextResponse.json({ error: 'Failed to create payroll entry' }, { status: 500 })
  }
}
