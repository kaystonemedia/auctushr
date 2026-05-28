import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['admin'])
  if (auth.error) return auth.error

  try {
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

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, department, salary')
      .or(`id.eq.${employeeId},auth_user_id.eq.${employeeId}`)
      .maybeSingle()
    if (!profile) {
      return NextResponse.json(
        { error: 'Employee not found', employeeId },
        { status: 404 }
      )
    }

    const periodMonth = `${year}-${String(month).padStart(2, '0')}`
    const { data: payrollRows } = await supabaseAdmin
      .from('payroll_entries')
      .select('*')
      .eq('employee_id', profile.id)
      .eq('period_month', periodMonth)
      .order('updated_at', { ascending: false })
      .limit(1)

    const hasPayrollEntry = !!payrollRows && payrollRows.length > 0
    const payrollEntry = hasPayrollEntry ? payrollRows?.[0] : null

    // Test 3: Try to process payroll if it doesn't exist
    let processedPayroll: Record<string, unknown> | null = null
    if (!hasPayrollEntry) {
      try {
        const baseSalary = Number(profile.salary || 0)
        
        // Create a simple payroll entry (same logic as in payslip route)
        const productivityScore = 75 // Default score
        const performanceBonus = (productivityScore / 100) * (baseSalary * 0.1) // 10% of base salary
        const attendanceBonus = baseSalary * 0.05 // 5% attendance bonus
        const totalBonus = performanceBonus + attendanceBonus
        
        // Calculate deductions
        const tax = baseSalary * 0.15 // 15% tax
        const insurance = baseSalary * 0.05 // 5% insurance
        const other = baseSalary * 0.02 // 2% other deductions
        const totalDeductions = tax + insurance + other
        
        // Calculate final amounts
        const grossSalary = baseSalary + totalBonus
        const netPay = grossSalary - totalDeductions
        
        processedPayroll = {
          employeeId,
          employeeName: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown Employee',
          department: profile.department || 'Unassigned',
          baseSalary,
          performanceBonus,
          attendanceBonus,
          totalBonus,
          grossSalary,
          deductions: { tax, insurance, other },
          netPay,
          month,
          year: parseInt(year),
          processedAt: new Date().toISOString(),
          productivityScore,
          attendanceRate: 85 // Default attendance rate
        }
      } catch (error) {
        console.error('Error processing payroll:', error)
        return NextResponse.json({
          error: 'Failed to process payroll',
          details: error instanceof Error ? error.message : 'Unknown error',
          employeeId,
          month,
          year
        }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      employee: {
        id: employeeId,
        name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
        department: profile.department,
        salary: profile.salary
      },
      hasPayrollEntry,
      payrollEntry,
      processedPayroll,
      source: 'supabase'
    })

  } catch (error) {
    console.error('Error in test endpoint:', error)
    return NextResponse.json(
      { 
        error: 'Test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
} 