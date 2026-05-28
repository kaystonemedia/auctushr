import { NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

function todayDateString() {
  return new Date().toISOString().slice(0, 10)
}

async function loadTeamEmployees(role: string, profileId: string) {
  if (role === 'manager') {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('id, department, role, status, first_name, last_name, email')
      .eq('manager_id', profileId)
      .eq('role', 'employee')
    return data || []
  }

  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, department, role, status, first_name, last_name, email')
    .eq('role', 'employee')
  return data || []
}

export async function GET(request: Request) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = authResult.user.role
    if (!['admin', 'manager'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const today = todayDateString()
    const employees = await loadTeamEmployees(role, authResult.user.profileId)
    const teamIds = employees.map((e) => e.id)

    const [
      departmentsRes,
      tasksRes,
      attendanceRes,
      leaveTodayRes,
      leavePendingRes,
      productivityRes,
    ] = await Promise.all([
      supabaseAdmin.from('departments').select('id, name'),
      supabaseAdmin
        .from('tasks')
        .select('id, status')
        .in('status', ['pending', 'in_progress', 'accepted', 'backlog']),
      teamIds.length > 0
        ? supabaseAdmin
            .from('attendance_records')
            .select('id, status, employee_id')
            .eq('date', today)
            .in('employee_id', teamIds)
        : supabaseAdmin
            .from('attendance_records')
            .select('id, status, employee_id')
            .eq('date', today)
            .limit(0),
      teamIds.length > 0
        ? supabaseAdmin
            .from('leave_requests')
            .select('id, status, employee_id')
            .eq('status', 'approved')
            .lte('start_date', today)
            .gte('end_date', today)
            .in('employee_id', teamIds)
        : { data: [] },
      role === 'manager'
        ? teamIds.length > 0
          ? supabaseAdmin
              .from('leave_requests')
              .select('id')
              .eq('status', 'pending')
              .or(
                `manager_id.eq.${authResult.user.profileId},employee_id.in.(${teamIds.join(',')})`
              )
          : supabaseAdmin
              .from('leave_requests')
              .select('id')
              .eq('status', 'pending')
              .eq('manager_id', authResult.user.profileId)
        : supabaseAdmin.from('leave_requests').select('id').eq('status', 'pending'),
      teamIds.length > 0
        ? supabaseAdmin
            .from('productivity_records')
            .select('productivity_score, user_id')
            .eq('date', today)
            .in('user_id', teamIds)
        : { data: [] },
    ])

    const departments = departmentsRes.data || []
    const tasks = tasksRes.data || []
    const attendance = attendanceRes.data || []
    const leaveToday = leaveTodayRes.data || []
    const leavePending = leavePendingRes.data || []
    const productivity = productivityRes.data || []

    const attendanceByEmployee = new Map(attendance.map((a) => [a.employee_id, a.status]))
    const productivityByEmployee = new Map(
      productivity.map((p) => [p.user_id, Number(p.productivity_score || 0)])
    )

    const presentToday = attendance.filter((a) =>
      ['present', 'late', 'early_leave', 'half_day'].includes(a.status)
    ).length
    const lateToday = attendance.filter((a) => a.status === 'late').length
    const absentToday = Math.max(0, employees.length - presentToday - leaveToday.length)

    const scores = productivity.map((p) => Number(p.productivity_score || 0))
    const averageProductivityScore =
      scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
    const topPerformers = scores.filter((s) => s >= 80).length

    const departmentCounts = new Map<string, number>()
    for (const emp of employees) {
      const dept = emp.department || 'Unassigned'
      departmentCounts.set(dept, (departmentCounts.get(dept) || 0) + 1)
    }

    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-indigo-500',
      'bg-purple-500',
      'bg-orange-500',
      'bg-teal-500',
    ]
    const departmentData = Array.from(departmentCounts.entries()).map(([department, value], i) => ({
      department,
      value,
      color: colors[i % colors.length],
    }))

    const teamMembers = employees.map((emp) => {
      const attStatus = attendanceByEmployee.get(emp.id)
      const onLeave = leaveToday.some((l) => l.employee_id === emp.id)
      let status = 'absent'
      if (onLeave) status = 'on_leave'
      else if (attStatus === 'late') status = 'late'
      else if (attStatus && ['present', 'early_leave', 'half_day'].includes(attStatus)) status = 'present'
      else if (attStatus) status = attStatus

      return {
        id: emp.id,
        name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.email || 'Unknown',
        role: emp.role || 'employee',
        status,
        lastActive: new Date(),
        productivityScore: productivityByEmployee.get(emp.id) || 0,
        email: emp.email,
      }
    })

    const { data: recentAudit } = await supabaseAdmin
      .from('audit_logs')
      .select('action, details, created_at, actor_id')
      .order('created_at', { ascending: false })
      .limit(8)

    const recentActivity = (recentAudit || []).map((row) => ({
      type: row.action,
      description: String((row.details as Record<string, unknown>)?.message || row.action),
      timestamp: row.created_at ? new Date(row.created_at) : new Date(),
      user: row.actor_id || 'System',
    }))

    const stats = {
      totalEmployees: employees.length,
      teamSize: employees.length,
      departments: departments.length,
      activeProjects: tasks.length,
      pendingApprovals: leavePending.length,
      presentToday,
      lateToday,
      absentToday,
      onLeaveToday: leaveToday.length,
      averageProductivityScore,
      topPerformers,
      productivityTrend: 0,
      teamProductivityTrend: 0,
    }

    return NextResponse.json({
      stats,
      departmentData,
      recentActivity,
      teamMembers,
      role,
    })
  } catch (error) {
    console.error('Dashboard summary error:', error)
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 })
  }
}
