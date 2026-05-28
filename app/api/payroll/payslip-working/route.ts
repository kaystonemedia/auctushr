import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api-auth'
import { safeLogAudit } from '@/lib/audit'
import { supabaseAdmin } from '@/lib/supabase/admin'

function normalizePeriod(month: string, year: string) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function sumDeductions(value: unknown): number {
  if (typeof value === 'number') return value
  if (Array.isArray(value)) {
    return value.reduce((sum, item) => {
      if (item && typeof item === 'object' && 'amount' in item) {
        return sum + Number((item as { amount?: number }).amount || 0)
      }
      return sum
    }, 0)
  }
  return 0
}

function mapPayrollRowToPayslip(row: Record<string, unknown>) {
  const profile = (row.profiles ?? {}) as Record<string, unknown>
  const payment = (row.payment ?? {}) as Record<string, unknown>
  const periodMonth = String(row.period_month || '')
  const [pYear = '', pMonth = ''] = periodMonth.split('-')
  const totalDeductions = sumDeductions(row.deductions)
  const grossSalary = Number(row.gross_salary || 0)
  const bonus = Number(row.bonus || 0)
  const netPay = Number(row.net_salary || 0)

  const employeeName =
    String(payment.employeeName || '').trim() ||
    `${profile.first_name || ''} ${profile.last_name || ''}`.trim() ||
    'Unknown Employee'

  const department =
    String(payment.department || profile.department || 'Unassigned')

  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName,
    department,
    position: profile.position || payment.position || 'Employee',
    baseSalary: Number(row.basic_salary ?? grossSalary - bonus) || 0,
    performanceBonus: Number(payment.performanceBonus || 0),
    attendanceBonus: Number(payment.attendanceBonus || 0),
    totalBonus: bonus,
    grossSalary,
    totalDeductions,
    deductions:
      row.deductions && typeof row.deductions === 'object' && !Array.isArray(row.deductions)
        ? row.deductions
        : {
            tax: totalDeductions * 0.5,
            insurance: totalDeductions * 0.3,
            other: totalDeductions * 0.2
          },
    netPay,
    month: pMonth,
    year: parseInt(pYear, 10) || new Date().getFullYear(),
    processedAt: row.updated_at || row.created_at,
    metadata: payment
  }
}

async function resolveProfile(idOrUid: string) {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .or(`id.eq.${idOrUid},auth_user_id.eq.${idOrUid}`)
    .maybeSingle()
  return data
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRole(request, ['admin', 'manager', 'employee'])
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user = authResult.user
    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const month = searchParams.get('month')
    const year = searchParams.get('year')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)

    if (!employeeId) {
      let query = supabaseAdmin
        .from('payroll_entries')
        .select('*, profiles:employee_id(id, first_name, last_name, department, position)')
        .order('updated_at', { ascending: false })
        .limit(limit)
      if (month && year) {
        query = query.eq('period_month', normalizePeriod(month, year))
      }
      if (user.role === 'employee') {
        query = query.eq('employee_id', user.profileId)
      } else if (user.role === 'manager') {
        const { data: team } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('manager_id', user.profileId)
        const teamIds = (team || []).map((row) => row.id)
        query = query.in('employee_id', teamIds.length > 0 ? teamIds : ['__none__'])
      }
      const { data, error } = await query
      if (error) throw error
      const payslips = (data || []).map((row) =>
        mapPayrollRowToPayslip(row as Record<string, unknown>)
      )
      return NextResponse.json({ success: true, payslips })
    }

    const employee = await resolveProfile(employeeId)
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    if (user.role === 'employee' && user.profileId !== employee.id) {
      return NextResponse.json({ error: 'Forbidden - you can only view your own payslip' }, { status: 403 })
    }
    if (user.role === 'manager' && employee.manager_id !== user.profileId) {
      return NextResponse.json({ error: 'Forbidden - not in your team' }, { status: 403 })
    }

    let rowQuery = supabaseAdmin
      .from('payroll_entries')
      .select('*')
      .eq('employee_id', employee.id)
      .order('updated_at', { ascending: false })
      .limit(1)
    if (month && year) {
      rowQuery = rowQuery.eq('period_month', normalizePeriod(month, year))
    }
    const { data: payrollRow, error: payrollError } = await rowQuery.maybeSingle()
    if (payrollError) throw payrollError
    if (!payrollRow) {
      return NextResponse.json({ error: 'No payroll data found for the specified period' }, { status: 404 })
    }

    const payslipData = mapPayrollRowToPayslip({
      ...payrollRow,
      profiles: employee
    } as Record<string, unknown>)

    await safeLogAudit('payroll.payslip.working.fetch', {
      actorId: user.uid,
      actorRole: user.role,
      targetType: 'employee',
      targetId: employee.id,
      outcome: 'success',
      metadata: { month: pMonth, year: pYear }
    })
    return NextResponse.json({ success: true, payslip: payslipData })
  } catch (error) {
    console.error('Error generating payslip-working response:', error)
    return NextResponse.json(
      { error: 'Failed to generate payslip', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireRole(request, ['admin', 'manager'])
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user = authResult.user
    const body = await request.json()
    const { employeeId, month, year, customData } = body
    if (!employeeId || !month || !year) {
      return NextResponse.json({ error: 'Missing required parameters: employeeId, month, year' }, { status: 400 })
    }

    const employee = await resolveProfile(employeeId)
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

    const periodMonth = normalizePeriod(month, year)
    const baseSalary = Number((customData?.baseSalary ?? employee.salary) || 0)
    const bonus = Number(customData?.totalBonus || customData?.bonus || 0)
    const deductions = Number(customData?.totalDeductions || customData?.deductions || 0)
    const netSalary = Number(customData?.netPay || (baseSalary + bonus - deductions))

    const payload = {
      employee_id: employee.id,
      period_month: periodMonth,
      gross_salary: baseSalary + bonus,
      bonus,
      deductions,
      net_salary: netSalary,
      status: 'processed' as const,
      payment: {
        generatedBy: user.profileId,
        source: 'payslip_working_api',
        ...(customData || {})
      }
    }

    const { data: existing } = await supabaseAdmin
      .from('payroll_entries')
      .select('id')
      .eq('employee_id', employee.id)
      .eq('period_month', periodMonth)
      .maybeSingle()

    const { data: saved, error } = existing
      ? await supabaseAdmin.from('payroll_entries').update(payload).eq('id', existing.id).select('*').single()
      : await supabaseAdmin.from('payroll_entries').insert(payload).select('*').single()
    if (error) throw error

    await safeLogAudit('payroll.payslip.working.generate', {
      actorId: user.uid,
      actorRole: user.role,
      targetType: 'employee',
      targetId: employee.id,
      outcome: 'success',
      metadata: { month, year, periodMonth }
    })
    return NextResponse.json({
      success: true,
      payslip: mapPayrollRowToPayslip({
        ...saved,
        profiles: employee
      } as Record<string, unknown>)
    })
  } catch (error) {
    console.error('Error processing payslip-working:', error)
    return NextResponse.json(
      { error: 'Failed to process payroll', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
