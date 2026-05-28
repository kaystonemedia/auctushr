import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

function getScoreColor(score: number): string {
  if (score >= 80) return 'bg-teal-500'
  if (score >= 60) return 'bg-blue-500'
  if (score >= 40) return 'bg-yellow-500'
  return 'bg-orange-500'
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(now.getDate() - 30)
    const fromDate = thirtyDaysAgo.toISOString().slice(0, 10)
    const toDate = now.toISOString().slice(0, 10)

    const { data: employees, error: employeesError } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, department, position')
      .eq('role', 'employee')
    if (employeesError) throw employeesError

    const employeeIds = (employees || []).map((employee) => employee.id)
    const { data: productivityRows, error: prodError } = await supabaseAdmin
      .from('productivity_records')
      .select('user_id, productivity_score, date')
      .gte('date', fromDate)
      .lte('date', toDate)
      .in('user_id', employeeIds)
    if (prodError) throw prodError

    const byEmployee = new Map<string, { scores: number[]; latestDate?: string }>()
    for (const row of productivityRows || []) {
      const entry = byEmployee.get(row.user_id) || { scores: [] }
      entry.scores.push(Number(row.productivity_score || 0))
      if (!entry.latestDate || row.date > entry.latestDate) {
        entry.latestDate = row.date
      }
      byEmployee.set(row.user_id, entry)
    }

    const employeeWellness = (employees || [])
      .map((employee) => {
        const data = byEmployee.get(employee.id)
        if (!data || data.scores.length === 0) return null
        const score = Math.round(data.scores.reduce((acc, value) => acc + value, 0) / data.scores.length)
        return {
          id: `${employee.id}_${data.latestDate || fromDate}`,
          employeeId: employee.id,
          name: `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || 'Unknown',
          position: employee.position || 'Employee',
          avatar: `/placeholder.svg?height=40&width=40`,
          score,
          scoreColor: getScoreColor(score),
          metrics: [],
          timestamp: data.latestDate ? new Date(data.latestDate) : new Date(),
        }
      })
      .filter(Boolean)

    const departmentMap = new Map<string, { total: number; count: number }>()
    for (const entry of employeeWellness as Array<{ department?: string; score: number; employeeId: string }>) {
      const department = (employees || []).find((employee) => employee.id === entry.employeeId)?.department || 'Unassigned'
      const existing = departmentMap.get(department) || { total: 0, count: 0 }
      existing.total += entry.score
      existing.count += 1
      departmentMap.set(department, existing)
    }

    const colors = ['bg-blue-500', 'bg-teal-500', 'bg-indigo-500', 'bg-purple-500', 'bg-orange-500', 'bg-green-500']
    const departments = Array.from(departmentMap.entries())
      .map(([name, value], index) => ({
        name,
        score: Math.round(value.total / value.count),
        color: colors[index % colors.length],
      }))
      .sort((a, b) => b.score - a.score)

    return NextResponse.json({
      departments,
      employees: employeeWellness,
      range: { fromDate, toDate },
    })
  } catch (error) {
    console.error('Wellness summary error:', error)
    return NextResponse.json({ error: 'Failed to load wellness summary' }, { status: 500 })
  }
}

