import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

type TaskRow = {
  id: string
  status: string
  priority: string
  category: string | null
  created_at: string
  due_date: string
  completed_at: string | null
  actual_hours: number | null
  metadata: Record<string, unknown> | null
}

function summarizeTasks(rows: TaskRow[]) {
  const total = rows.length
  const completed = rows.filter((row) => row.status === 'completed').length
  const cancelled = rows.filter((row) => row.status === 'cancelled').length
  const inProgress = rows.filter((row) => row.status === 'in_progress').length
  const accepted = rows.filter((row) => row.status === 'accepted').length
  const pending = rows.filter((row) => row.status === 'pending' || row.status === 'backlog').length
  const onTime = rows.filter((row) => row.status === 'completed' && row.completed_at && new Date(row.completed_at) <= new Date(row.due_date)).length
  const overdue = rows.filter((row) => row.status !== 'completed' && new Date(row.due_date) < new Date()).length
  const averageCompletionHours = completed > 0
    ? rows
      .filter((row) => row.status === 'completed')
      .reduce((sum, row) => sum + Number(row.actual_hours || 0), 0) / completed
    : 0

  const byPriority = {
    low: rows.filter((row) => row.priority === 'low').length,
    medium: rows.filter((row) => row.priority === 'medium').length,
    high: rows.filter((row) => row.priority === 'high').length,
    urgent: rows.filter((row) => row.priority === 'urgent').length
  }

  return {
    total,
    completed,
    cancelled,
    inProgress,
    accepted,
    pending,
    overdue,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    onTimeRate: completed > 0 ? Math.round((onTime / completed) * 100) : 0,
    averageCompletionHours: Number(averageCompletionHours.toFixed(2)),
    byPriority
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!['admin', 'manager'].includes(authResult.user.role)) {
      return NextResponse.json({ error: 'Not authorized to view analytics' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const department = searchParams.get('department')
    const userId = searchParams.get('userId')
    const reportType = searchParams.get('reportType') || 'overview'

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const end = endDate ? new Date(endDate) : new Date()

    let query = supabaseAdmin
      .from('tasks')
      .select('id, status, priority, category, created_at, due_date, completed_at, actual_hours, metadata')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())

    if (department) {
      query = query.eq('department', department)
    }

    const { data, error } = await query
    if (error) throw error

    let rows = (data || []) as TaskRow[]
    if (userId) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .or(`id.eq.${userId},auth_user_id.eq.${userId}`)
        .maybeSingle()
      if (!profile) {
        rows = []
      } else {
        const { data: links } = await supabaseAdmin
          .from('task_assignees')
          .select('task_id')
          .eq('assignee_id', profile.id)
        const assignedTaskIds = new Set((links || []).map((link) => link.task_id))
        rows = rows.filter((row) => assignedTaskIds.has(row.id))
      }
    }

    const overview = summarizeTasks(rows)
    const analytics = reportType === 'detailed'
      ? {
          ...overview,
          byCategory: rows.reduce((acc, row) => {
            const key = row.category || 'general'
            acc[key] = (acc[key] || 0) + 1
            return acc
          }, {} as Record<string, number>)
        }
      : reportType === 'productivity'
      ? {
          ...overview,
          productivityImpact: rows.reduce((acc, row) => {
            const impact = ((row.metadata || {}).productivityImpact as string) || 'neutral'
            acc[impact] = (acc[impact] || 0) + 1
            return acc
          }, {} as Record<string, number>)
        }
      : overview

    return NextResponse.json({
      analytics,
      filters: { startDate: start, endDate: end, department, userId, reportType },
      totalTasks: rows.length
    })
  } catch (error) {
    console.error('Error fetching task analytics:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!['admin', 'manager'].includes(authResult.user.role)) {
      return NextResponse.json({ error: 'Not authorized to view team analytics' }, { status: 403 })
    }

    const body = await request.json()
    const { department, startDate, endDate } = body
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const end = endDate ? new Date(endDate) : new Date()

    let membersQuery = supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, department')
      .in('role', ['employee', 'manager'])
    if (department) {
      membersQuery = membersQuery.eq('department', department)
    }
    const { data: members, error: membersError } = await membersQuery
    if (membersError) throw membersError

    const memberIds = (members || []).map((m) => m.id)
    const { data: links, error: linksError } = await supabaseAdmin
      .from('task_assignees')
      .select('task_id, assignee_id')
      .in('assignee_id', memberIds)
    if (linksError) throw linksError

    const taskIds = Array.from(new Set((links || []).map((l) => l.task_id)))
    const { data: tasks, error: tasksError } = await supabaseAdmin
      .from('tasks')
      .select('id, status, due_date, completed_at, actual_hours, created_at')
      .in('id', taskIds)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
    if (tasksError) throw tasksError

    const taskMap = new Map((tasks || []).map((task) => [task.id, task]))
    const memberStats = (members || []).map((member) => {
      const memberTaskLinks = (links || []).filter((link) => link.assignee_id === member.id)
      const memberTasks = memberTaskLinks.map((link) => taskMap.get(link.task_id)).filter(Boolean) as Array<{
        status: string
        due_date: string
        completed_at: string | null
        actual_hours: number | null
      }>
      const completedTasks = memberTasks.filter((task) => task.status === 'completed')
      const onTimeCount = completedTasks.filter((task) => task.completed_at && new Date(task.completed_at) <= new Date(task.due_date)).length
      return {
        memberId: member.id,
        memberName: `${member.first_name || ''} ${member.last_name || ''}`.trim() || 'User',
        totalTasks: memberTasks.length,
        completedTasks: completedTasks.length,
        onTimeRate: completedTasks.length > 0 ? Math.round((onTimeCount / completedTasks.length) * 100) : 0,
        averageCompletionTime: completedTasks.length > 0
          ? completedTasks.reduce((sum, task) => sum + Number(task.actual_hours || 0), 0) / completedTasks.length
          : 0
      }
    })

    return NextResponse.json({
      teamAnalytics: {
        memberStats,
        teamMetrics: {
          totalTasks: tasks?.length || 0,
          averageCompletionRate: tasks && tasks.length > 0
            ? Math.round((tasks.filter((task) => task.status === 'completed').length / tasks.length) * 100)
            : 0,
          averageOnTimeRate: memberStats.length > 0
            ? Math.round(memberStats.reduce((sum, member) => sum + member.onTimeRate, 0) / memberStats.length)
            : 0,
          topPerformers: [...memberStats].sort((a, b) => b.completedTasks - a.completedTasks).slice(0, 5)
        }
      },
      teamSize: members?.length || 0,
      totalTasks: tasks?.length || 0,
      period: { start, end }
    })
  } catch (error) {
    console.error('Error fetching team analytics:', error)
    return NextResponse.json({ error: 'Failed to fetch team analytics' }, { status: 500 })
  }
}







