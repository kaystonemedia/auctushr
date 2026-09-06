import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/api-auth'
import { getBiweeklyPeriodForDate, periodStartDateString, periodEndDateString } from '@/lib/pay-periods'

type PayrollInsightRow = {
  net_salary: number | null
  bonus: number | null
  payment: {
    productivityScore?: number
    department?: string
  } | null
  period_start_date: string
}

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['admin', 'manager'])
  if (auth.error) return auth.error

  try {
    void request
    const currentPeriod = getBiweeklyPeriodForDate(new Date())

    const { data: payrollEntries, error } = await supabaseAdmin
      .from('payroll_entries')
      .select('net_salary, bonus, payment, period_start_date')
      .eq('period_start_date', periodStartDateString(currentPeriod))
      .eq('period_end_date', periodEndDateString(currentPeriod))

    if (error) {
      throw error
    }

    const rows: PayrollInsightRow[] = (payrollEntries || []) as PayrollInsightRow[]

    const totalPayrollThisMonth = rows.reduce((sum, entry) => sum + Number(entry.net_salary || 0), 0)
    const averageProductivity = rows.length > 0
      ? rows.reduce((sum, entry) => sum + Number(entry.payment?.productivityScore || 0), 0) / rows.length
      : 0
    const totalBonusesDistributed = rows.reduce((sum, entry) => sum + Number(entry.bonus || 0), 0)

    // Group by department
    const departmentStats = rows.reduce((
      acc: Record<string, { totalProductivity: number; totalBonuses: number; count: number }>,
      entry: PayrollInsightRow
    ) => {
      const department = entry.payment?.department || 'Unassigned'
      if (!acc[department]) {
        acc[department] = {
          totalProductivity: 0,
          totalBonuses: 0,
          count: 0
        }
      }
      acc[department].totalProductivity += Number(entry.payment?.productivityScore || 0)
      acc[department].totalBonuses += Number(entry.bonus || 0)
      acc[department].count++
      return acc
    }, {} as Record<string, { totalProductivity: number; totalBonuses: number; count: number }>)

    const entries = Object.entries(departmentStats) as Array<[
      string,
      { totalProductivity: number; totalBonuses: number; count: number }
    ]>
    const topPerformingDepartments = entries
      .map(([department, stats]) => ({
        department,
        averageProductivity: stats.totalProductivity / stats.count,
        totalBonuses: stats.totalBonuses
      }))
      .sort((a, b) => b.averageProductivity - a.averageProductivity)
      .slice(0, 5)

    return NextResponse.json({
      success: true,
      totalPayrollThisMonth,
      averageProductivity,
      totalBonusesDistributed,
      topPerformingDepartments
    })

  } catch (error) {
    console.error('Error fetching payroll insights:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch payroll insights',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 