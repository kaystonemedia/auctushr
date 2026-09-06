import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api-auth'
import { safeLogAudit } from '@/lib/audit'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { settingsService } from '@/lib/settings'
import {
  getBiweeklyPeriodForDate,
  periodStartDateString,
  periodEndDateString
} from '@/lib/pay-periods'

type MappedPayslip = ReturnType<typeof mapPayrollRowToPayslip>

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
  const rawBankAccount = (profile.bank_account ?? null) as Record<string, unknown> | null

  const grossSalary = Number(row.gross_salary || 0)
  const bonus = Number(row.bonus || 0)
  const netPay = Number(row.net_salary || 0)
  const overtimeHours = Number(row.overtime_hours || 0)
  const overtimeRate = Number(row.overtime_rate || 0)

  const deductions = Array.isArray(row.deductions) ? row.deductions : []
  const allowances = Array.isArray(row.allowances) ? row.allowances : []
  const totalDeductions = deductions.length > 0 ? sumDeductions(deductions) : sumDeductions(row.deductions)

  const employeeName =
    String(payment.employeeName || '').trim() ||
    `${profile.first_name || ''} ${profile.last_name || ''}`.trim() ||
    'Unknown Employee'

  const department = String(payment.department || profile.department || 'Unassigned')
  const periodStartDate = row.period_start_date ? String(row.period_start_date) : null
  const periodEndDate = row.period_end_date ? String(row.period_end_date) : null

  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeCode: (profile.employee_code as string) || null,
    employeeName,
    department,
    position: (profile.position as string) || (payment.position as string) || 'Employee',
    ssnitNumber: (profile.ssnit_number as string) || null,
    bankAccount: rawBankAccount
      ? {
          accountNumber: (rawBankAccount.accountNumber || rawBankAccount.account_number || '') as string,
          bankName: (rawBankAccount.bankName || rawBankAccount.bank_name || rawBankAccount.bankCode || '') as string,
          branch: (rawBankAccount.branch || '') as string,
          accountName: (rawBankAccount.accountName || rawBankAccount.account_name || '') as string
        }
      : null,
    baseSalary: Number(row.basic_salary ?? grossSalary - bonus) || 0,
    performanceBonus: Number(payment.performanceBonus || 0),
    attendanceBonus: Number(payment.attendanceBonus || 0),
    overtimeHours,
    overtimeRate,
    overtimeAmount: overtimeHours * overtimeRate,
    totalBonus: bonus,
    grossSalary,
    allowances,
    deductions,
    totalDeductions,
    netPay,
    payFrequency: (row.pay_frequency as string) || 'biweekly',
    periodStartDate,
    periodEndDate,
    daysWorked: row.days_worked != null ? Number(row.days_worked) : null,
    daysAbsent: row.days_absent != null ? Number(row.days_absent) : null,
    currency: (row.currency as string) || 'GHS',
    exchangeRate: row.exchange_rate != null ? Number(row.exchange_rate) : null,
    paymentDate: row.payment_date || null,
    month: periodStartDate ? periodStartDate.slice(5, 7) : '',
    year: periodStartDate ? parseInt(periodStartDate.slice(0, 4), 10) : new Date().getFullYear(),
    processedAt: row.updated_at || row.created_at,
    metadata: payment
  }
}

function aggregateAnnualPayslip(entries: MappedPayslip[], year: number) {
  if (entries.length === 0) return null

  const sumField = (key: keyof MappedPayslip) =>
    entries.reduce((sum, entry) => sum + Number((entry[key] as number) || 0), 0)

  const mergeLineItems = (key: 'allowances' | 'deductions') => {
    const merged = new Map<string, { type: string; name: string; amount: number }>()
    for (const entry of entries) {
      for (const item of entry[key] as Array<{ type?: string; name?: string; amount?: number }>) {
        const name = item?.name || item?.type || 'Other'
        const existing = merged.get(name)
        if (existing) {
          existing.amount += Number(item?.amount || 0)
        } else {
          merged.set(name, { type: item?.type || 'other', name, amount: Number(item?.amount || 0) })
        }
      }
    }
    return Array.from(merged.values())
  }

  const first = entries[0]
  return {
    id: `annual-${first.employeeId}-${year}`,
    employeeId: first.employeeId,
    employeeCode: first.employeeCode,
    employeeName: first.employeeName,
    department: first.department,
    position: first.position,
    ssnitNumber: first.ssnitNumber,
    bankAccount: first.bankAccount,
    baseSalary: sumField('baseSalary'),
    performanceBonus: sumField('performanceBonus'),
    attendanceBonus: sumField('attendanceBonus'),
    overtimeHours: sumField('overtimeHours'),
    overtimeRate: 0,
    overtimeAmount: sumField('overtimeAmount'),
    totalBonus: sumField('totalBonus'),
    grossSalary: sumField('grossSalary'),
    allowances: mergeLineItems('allowances'),
    deductions: mergeLineItems('deductions'),
    totalDeductions: sumField('totalDeductions'),
    netPay: sumField('netPay'),
    payFrequency: 'annual' as const,
    periodStartDate: `${year}-01-01`,
    periodEndDate: `${year}-12-31`,
    daysWorked: sumField('daysWorked'),
    daysAbsent: sumField('daysAbsent'),
    currency: first.currency,
    exchangeRate: first.exchangeRate,
    paymentDate: null,
    month: '',
    year,
    processedAt: new Date().toISOString(),
    metadata: { periodsIncluded: entries.length }
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

/** Snapshot days worked / absent from attendance_records for a payroll period. */
async function computeAttendanceSummary(employeeId: string, startDate: string, endDate: string) {
  const { data } = await supabaseAdmin
    .from('attendance_records')
    .select('status, check_in_time')
    .eq('employee_id', employeeId)
    .gte('date', startDate)
    .lte('date', endDate)

  const records = data || []
  const daysWorked = records.filter((r) => r.check_in_time || r.status === 'present').length
  const daysAbsent = records.filter((r) => r.status === 'absent').length
  return { daysWorked, daysAbsent }
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
    const periodStart = searchParams.get('periodStart')
    const periodEnd = searchParams.get('periodEnd')
    const year = searchParams.get('year')
    const frequency = searchParams.get('frequency')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)

    // Annual (yearly) payslip: aggregated on the fly from that employee's
    // biweekly entries for the year — no separate DB row is stored.
    if (frequency === 'annual') {
      if (!employeeId || !year) {
        return NextResponse.json({ error: 'employeeId and year are required for an annual payslip' }, { status: 400 })
      }
      const employee = await resolveProfile(employeeId)
      if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
      if (user.role === 'employee' && user.profileId !== employee.id) {
        return NextResponse.json({ error: 'Forbidden - you can only view your own payslip' }, { status: 403 })
      }
      if (user.role === 'manager' && employee.manager_id !== user.profileId) {
        return NextResponse.json({ error: 'Forbidden - not in your team' }, { status: 403 })
      }

      const yearNum = parseInt(year, 10)
      const { data, error } = await supabaseAdmin
        .from('payroll_entries')
        .select('*')
        .eq('employee_id', employee.id)
        .eq('pay_frequency', 'biweekly')
        .gte('period_start_date', `${yearNum}-01-01`)
        .lte('period_end_date', `${yearNum}-12-31`)
        .order('period_start_date', { ascending: true })
      if (error) throw error

      const entries = (data || []).map((row) =>
        mapPayrollRowToPayslip({ ...row, profiles: employee } as Record<string, unknown>)
      )
      const annualPayslip = aggregateAnnualPayslip(entries, yearNum)
      if (!annualPayslip) {
        return NextResponse.json({ error: 'No payroll entries found for that year' }, { status: 404 })
      }

      await safeLogAudit('payroll.payslip.annual.fetch', {
        actorId: user.uid,
        actorRole: user.role,
        targetType: 'employee',
        targetId: employee.id,
        outcome: 'success',
        metadata: { year: yearNum, periodsIncluded: entries.length }
      })
      return NextResponse.json({ success: true, payslip: annualPayslip })
    }

    if (!employeeId) {
      let query = supabaseAdmin
        .from('payroll_entries')
        .select('*, profiles:employee_id(id, employee_code, first_name, last_name, department, position, ssnit_number, bank_account)')
        .order('updated_at', { ascending: false })
        .limit(limit)
      if (periodStart) query = query.gte('period_start_date', periodStart)
      if (periodEnd) query = query.lte('period_end_date', periodEnd)
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
    if (periodStart) rowQuery = rowQuery.eq('period_start_date', periodStart)
    if (periodEnd) rowQuery = rowQuery.eq('period_end_date', periodEnd)
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
      metadata: { periodStartDate: payslipData.periodStartDate, periodEndDate: payslipData.periodEndDate }
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
    const { employeeId, periodStart, periodEnd, customData } = body
    if (!employeeId) {
      return NextResponse.json({ error: 'Missing required parameter: employeeId' }, { status: 400 })
    }

    const employee = await resolveProfile(employeeId)
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

    // Default to the biweekly period containing today if the caller didn't pick one.
    const period = periodStart && periodEnd
      ? { start: new Date(periodStart), end: new Date(periodEnd) }
      : getBiweeklyPeriodForDate(new Date())
    const startDateStr = periodStart || periodStartDateString(period)
    const endDateStr = periodEnd || periodEndDateString(period)

    const baseSalary = Number((customData?.baseSalary ?? employee.salary) || 0)
    const bonus = Number(customData?.totalBonus || customData?.bonus || 0)
    const deductionsTotal = Number(customData?.totalDeductions || customData?.deductions || 0)
    const netSalary = Number(customData?.netPay || (baseSalary + bonus - deductionsTotal))

    const { daysWorked, daysAbsent } = await computeAttendanceSummary(employee.id, startDateStr, endDateStr)

    let currency = 'GHS'
    let exchangeRate: number | null = null
    try {
      const payrollSettings = await settingsService.getPayrollSettings()
      currency = payrollSettings.currency || currency
      exchangeRate = payrollSettings.exchangeRate ?? null
    } catch (settingsError) {
      console.warn('Failed to load payroll settings for payslip generation:', settingsError)
    }

    const payload = {
      employee_id: employee.id,
      period_start_date: startDateStr,
      period_end_date: endDateStr,
      pay_frequency: 'biweekly' as const,
      gross_salary: baseSalary + bonus,
      basic_salary: baseSalary,
      bonus,
      deductions: Array.isArray(customData?.deductionItems) ? customData.deductionItems : [],
      allowances: Array.isArray(customData?.allowanceItems) ? customData.allowanceItems : [],
      net_salary: netSalary,
      days_worked: daysWorked,
      days_absent: daysAbsent,
      currency,
      exchange_rate: exchangeRate,
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
      .eq('period_start_date', startDateStr)
      .eq('period_end_date', endDateStr)
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
      metadata: { periodStartDate: startDateStr, periodEndDate: endDateStr }
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
