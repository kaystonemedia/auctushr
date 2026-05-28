import { NextRequest, NextResponse } from 'next/server'
import { safeLogAudit } from '@/lib/audit'
import { requireRole } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

function normalizePeriod(month: string, year: string) {
  return `${year}-${String(month).padStart(2, '0')}`
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
    if (!employeeId || !month || !year) {
      return NextResponse.json(
        { error: 'Missing required parameters: employeeId, month, year' },
        { status: 400 }
      )
    }

    const employee = await resolveProfile(employeeId)
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }
    if (user.role === 'employee' && user.profileId !== employee.id && user.uid !== employee.auth_user_id) {
      return NextResponse.json({ error: 'Forbidden - you can only view your own payslip' }, { status: 403 })
    }

    const periodMonth = normalizePeriod(month, year)
    const { data: payrollRow, error: payrollError } = await supabaseAdmin
      .from('payroll_entries')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('period_month', periodMonth)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (payrollError) throw payrollError
    if (!payrollRow) {
      return NextResponse.json({ error: 'No payroll data found for the specified period' }, { status: 404 })
    }

    const periodStart = new Date(`${periodMonth}-01T00:00:00.000Z`)
    const periodEnd = new Date(periodStart)
    periodEnd.setMonth(periodEnd.getMonth() + 1)
    periodEnd.setMilliseconds(-1)
    const { data: attendanceRows } = await supabaseAdmin
      .from('attendance_records')
      .select('status')
      .eq('employee_id', employee.id)
      .gte('date', periodStart.toISOString().slice(0, 10))
      .lte('date', periodEnd.toISOString().slice(0, 10))
    const totalDays = attendanceRows?.length || 0
    const presentDays = (attendanceRows || []).filter((record) => record.status === 'present').length
    const attendanceRate = totalDays > 0 ? (presentDays / totalDays) * 100 : 0

    const paymentMeta = (payrollRow.payment || {}) as Record<string, unknown>
    const bonus = Number(payrollRow.bonus || 0)
    const deductions = Number(payrollRow.deductions || 0)
    const netPay = Number(payrollRow.net_salary || 0)
    const grossSalary = netPay + deductions

    const payslipData = {
      employeeId: employee.id,
      employeeName: `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || 'Unknown Employee',
      department: employee.department || 'Unassigned',
      position: employee.position || 'Employee',
      baseSalary: grossSalary - bonus,
      performanceBonus: Number(paymentMeta.performanceBonus || 0),
      attendanceBonus: Number(paymentMeta.attendanceBonus || 0),
      totalBonus: bonus,
      grossSalary,
      deductions: {
        tax: Number(paymentMeta.tax || 0),
        insurance: Number(paymentMeta.insurance || 0),
        other: Number(paymentMeta.other || deductions)
      },
      totalDeductions: deductions,
      netPay,
      month,
      year: parseInt(year, 10),
      processedAt: payrollRow.updated_at,
      productivityScore: Number(paymentMeta.productivityScore || 75),
      attendanceRate,
      focusTimePercentage: Number(paymentMeta.focusTimePercentage || 60),
      taskCompletionRate: Number(paymentMeta.taskCompletionRate || 80),
      totalFocusSessions: Number(paymentMeta.totalFocusSessions || 0),
      totalTasksCompleted: Number(paymentMeta.totalTasksCompleted || 0),
      totalMeetingHours: Number(paymentMeta.totalMeetingHours || 0)
    }

    await safeLogAudit('payroll.payslip.fetch', {
      actorId: user.uid,
      actorRole: user.role,
      targetType: 'employee',
      targetId: employee.id,
      outcome: 'success',
      metadata: { month, year }
    })

    return NextResponse.json({ success: true, payslip: payslipData })
  } catch (error) {
    console.error('Error generating payslip:', error)
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }
    try {
      await safeLogAudit('payroll.payslip.fetch', { outcome: 'failure', metadata: errorDetails })
    } catch {}
    return NextResponse.json(
      { error: 'Failed to generate payslip', details: errorDetails.message },
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
      return NextResponse.json(
        { error: 'Missing required parameters: employeeId, month, year' },
        { status: 400 }
      )
    }

    const employee = await resolveProfile(employeeId)
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    const periodMonth = normalizePeriod(month, year)
    const { data: existingPayslip } = await supabaseAdmin
      .from('payroll_entries')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('period_month', periodMonth)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

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
        performanceBonus: Number(customData?.performanceBonus || 0),
        attendanceBonus: Number(customData?.attendanceBonus || 0),
        tax: Number(customData?.tax || 0),
        insurance: Number(customData?.insurance || 0),
        other: Number(customData?.other || deductions),
        generatedBy: user.profileId,
        source: 'payslip_api'
      }
    }

    const { data: savedPayslip, error: saveError } = existingPayslip
      ? await supabaseAdmin.from('payroll_entries').update(payload).eq('id', existingPayslip.id).select('*').single()
      : await supabaseAdmin.from('payroll_entries').insert(payload).select('*').single()
    if (saveError) throw saveError

    await safeLogAudit('payroll.payslip.generate', {
      actorId: user.uid,
      actorRole: user.role,
      targetType: 'employee',
      targetId: employee.id,
      outcome: 'success',
      metadata: { month, year, periodMonth }
    })

    return NextResponse.json({ success: true, payslip: savedPayslip })
  } catch (error) {
    console.error('Error processing payroll:', error)
    try {
      await safeLogAudit('payroll.payslip.generate', {
        outcome: 'failure',
        metadata: { message: error instanceof Error ? error.message : 'Unknown error' }
      })
    } catch {}
    return NextResponse.json(
      { error: 'Failed to process payroll', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
