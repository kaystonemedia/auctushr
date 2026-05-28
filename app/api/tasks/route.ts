import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TaskAssignee } from '@/types/task'

async function resolveProfileId(idOrUid: string) {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .or(`id.eq.${idOrUid},auth_user_id.eq.${idOrUid}`)
    .maybeSingle()
  return data?.id || null
}

async function loadTaskAssignees(taskIds: string[]) {
  if (taskIds.length === 0) return new Map<string, TaskAssignee[]>()
  const { data } = await supabaseAdmin
    .from('task_assignees')
    .select('task_id, assignee_id, assignment_type, profiles:assignee_id(id, first_name, last_name, department)')
    .in('task_id', taskIds)

  const result = new Map<string, TaskAssignee[]>()
  for (const row of data || []) {
    const current = result.get(row.task_id) || []
    const profile = row.profiles as unknown as { id: string; first_name?: string; last_name?: string; department?: string }
    current.push({
      id: row.assignee_id,
      name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'User',
      type: (row.assignment_type as 'user' | 'department' | 'team') || 'user',
      department: profile?.department
    })
    result.set(row.task_id, current)
  }
  return result
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const assigneeId = searchParams.get('assigneeId')
    const department = searchParams.get('department')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    let query = supabaseAdmin.from('tasks').select('*').order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (priority) query = query.eq('priority', priority)
    if (department) query = query.eq('department', department)

    const { data: taskRows, error } = await query.range((page - 1) * limit, page * limit - 1)
    if (error) throw error

    let filteredRows = taskRows || []
    if (assigneeId) {
      const profileId = await resolveProfileId(assigneeId)
      if (profileId) {
        const { data: links } = await supabaseAdmin
          .from('task_assignees')
          .select('task_id')
          .eq('assignee_id', profileId)
        const taskIdSet = new Set((links || []).map((link) => link.task_id))
        filteredRows = filteredRows.filter((row) => taskIdSet.has(row.id))
      } else {
        filteredRows = []
      }
    }

    if (search) {
      const term = search.toLowerCase()
      filteredRows = filteredRows.filter((task) =>
        (task.title || '').toLowerCase().includes(term) ||
        (task.description || '').toLowerCase().includes(term)
      )
    }

    const assigneeMap = await loadTaskAssignees(filteredRows.map((row) => row.id))
    const tasks = filteredRows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description || '',
      assignees: assigneeMap.get(row.id) || [],
      assignerId: row.assigner_id,
      department: row.department,
      priority: row.priority,
      status: row.status,
      category: row.category,
      dueDate: row.due_date ? new Date(row.due_date) : null,
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      estimatedHours: row.estimated_hours,
      actualHours: row.actual_hours,
      progress: row.progress,
      tags: row.tags || [],
      dependencies: row.dependencies || [],
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
      metadata: row.metadata || {}
    }))

    return NextResponse.json({
      tasks,
      pagination: {
        page,
        limit,
        total: tasks.length,
        hasMore: tasks.length === limit
      }
    })
  } catch (error) {
    console.error('Error fetching tasks:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!['admin', 'manager'].includes(authResult.user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const body = await request.json()
    const {
      title,
      description,
      assignees,
      priority,
      category,
      dueDate,
      estimatedHours,
      milestones,
      dependencies,
      tags,
      productivityImpact,
      difficulty
    } = body

    if (!title || !Array.isArray(assignees) || assignees.length === 0 || !priority || !dueDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const metadata = {
      milestones: milestones || [],
      productivityImpact: productivityImpact || 'neutral',
      difficulty: difficulty || 'medium',
      starred: false,
      timeTracking: { totalPausedDuration: 0 }
    }

    const { data: taskRow, error: taskError } = await supabaseAdmin
      .from('tasks')
      .insert({
        title,
        description: description || '',
        assigner_id: authResult.user.profileId,
        department: authResult.user.department || null,
        priority,
        status: 'backlog',
        category: category || 'general',
        due_date: new Date(dueDate).toISOString(),
        estimated_hours: estimatedHours || null,
        dependencies: dependencies || [],
        tags: tags || [],
        metadata
      })
      .select('*')
      .single()

    if (taskError || !taskRow) throw taskError

    const assigneeRows: Array<{ task_id: string; assignee_id: string; assignment_type: string }> = []
    for (const assignee of assignees) {
      const profileId = await resolveProfileId(assignee.id)
      if (!profileId) continue
      assigneeRows.push({
        task_id: taskRow.id,
        assignee_id: profileId,
        assignment_type: assignee.type || 'user'
      })
    }

    if (assigneeRows.length > 0) {
      await supabaseAdmin.from('task_assignees').insert(assigneeRows)
      await supabaseAdmin.from('notifications').insert(
        assigneeRows.map((row) => ({
          user_id: row.assignee_id,
          type: 'task_assigned',
          title: 'New Task Assigned',
          message: `You have been assigned a new task: ${title}`,
          read: false,
          data: { taskId: taskRow.id }
        }))
      )
    }

    await supabaseAdmin.from('task_records').insert({
      task_id: taskRow.id,
      user_id: authResult.user.profileId,
      action: 'assigned',
      notes: 'Task created and assigned',
      metadata: { assigneeCount: assigneeRows.length }
    })

    const assigneeMap = await loadTaskAssignees([taskRow.id])
    return NextResponse.json({
      id: taskRow.id,
      title: taskRow.title,
      description: taskRow.description || '',
      assignees: assigneeMap.get(taskRow.id) || [],
      priority: taskRow.priority,
      status: taskRow.status,
      category: taskRow.category,
      dueDate: taskRow.due_date,
      createdAt: taskRow.created_at
    })
  } catch (error) {
    console.error('Error creating task:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}







