import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

type RouteContext = { params: Promise<{ id: string }> }

async function resolveTaskAssignees(taskId: string) {
  const { data } = await supabaseAdmin
    .from('task_assignees')
    .select('assignee_id, assignment_type, profiles:assignee_id(first_name, last_name, department)')
    .eq('task_id', taskId)

  return (data || []).map((row) => {
    const profile = row.profiles as unknown as { first_name?: string; last_name?: string; department?: string }
    return {
      id: row.assignee_id,
      name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'User',
      type: row.assignment_type || 'user',
      department: profile?.department
    }
  })
}

// GET /api/tasks/[id] - Get single task
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: taskId } = await context.params
    const { data: taskRow, error: taskError } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .maybeSingle()

    if (taskError) throw taskError
    if (!taskRow) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const assignees = await resolveTaskAssignees(taskId)
    const canAccess = authResult.user.role === 'admin' ||
      taskRow.assigner_id === authResult.user.profileId ||
      assignees.some((a) => a.id === authResult.user.profileId)
    if (!canAccess) {
      return NextResponse.json({ error: 'Not authorized to view this task' }, { status: 403 })
    }

    const task = {
      id: taskRow.id,
      title: taskRow.title,
      description: taskRow.description || '',
      assignees,
      assignerId: taskRow.assigner_id,
      department: taskRow.department,
      priority: taskRow.priority,
      status: taskRow.status,
      category: taskRow.category,
      dueDate: taskRow.due_date ? new Date(taskRow.due_date) : null,
      completedAt: taskRow.completed_at ? new Date(taskRow.completed_at) : null,
      estimatedHours: taskRow.estimated_hours,
      actualHours: taskRow.actual_hours,
      progress: taskRow.progress,
      tags: taskRow.tags || [],
      dependencies: taskRow.dependencies || [],
      metadata: taskRow.metadata || {},
      createdAt: taskRow.created_at ? new Date(taskRow.created_at) : null,
      updatedAt: taskRow.updated_at ? new Date(taskRow.updated_at) : null
    }

    const { data: recordRows, error: recordsError } = await supabaseAdmin
      .from('task_records')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
    if (recordsError) throw recordsError

    const records = (recordRows || []).map((row) => ({
      id: row.id,
      taskId: row.task_id,
      userId: row.user_id,
      action: row.action,
      notes: row.notes,
      productivityScore: row.productivity_score,
      timestamp: row.created_at ? new Date(row.created_at) : null
    }))

    return NextResponse.json({
      task,
      records
    })
  } catch (error) {
    console.error('Error fetching task:', error)
    return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 })
  }
}

// PUT /api/tasks/[id] - Update single task
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id: taskId } = await context.params

    const { data: taskRow, error: taskError } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .maybeSingle()
    if (taskError) throw taskError
    if (!taskRow) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const now = new Date()
    const assignees = await resolveTaskAssignees(taskId)

    const isAssigner = taskRow.assigner_id === authResult.user.profileId
    const isAssignee = assignees.some((a) => a.id === authResult.user.profileId)
    if (!isAssigner && !isAssignee) {
      return NextResponse.json({ error: 'Not authorized to update this task' }, { status: 403 })
    }

    const updateData: Record<string, unknown> = {
      updated_at: now.toISOString()
    }
    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.priority !== undefined) updateData.priority = body.priority
    if (body.status !== undefined) updateData.status = body.status
    if (body.category !== undefined) updateData.category = body.category
    if (body.dueDate !== undefined) updateData.due_date = body.dueDate ? new Date(body.dueDate).toISOString() : null
    if (body.estimatedHours !== undefined) updateData.estimated_hours = body.estimatedHours
    if (body.actualHours !== undefined) updateData.actual_hours = body.actualHours
    if (body.progress !== undefined) updateData.progress = body.progress
    if (body.tags !== undefined) updateData.tags = body.tags

    if (body.status === 'completed') {
      updateData.completed_at = now.toISOString()
    }

    const { error: updateError } = await supabaseAdmin
      .from('tasks')
      .update(updateData)
      .eq('id', taskId)
    if (updateError) throw updateError

    if (body.action || body.status) {
      const action = body.action || body.status
      await supabaseAdmin.from('task_records').insert({
        task_id: taskId,
        user_id: authResult.user.profileId,
        action,
        notes: body.notes || `Task ${action}`
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating task:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}

// POST /api/tasks/[id]/comments - Add comment to task
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id: taskId } = await context.params
    const { content, attachments } = body

    if (!content) {
      return NextResponse.json({ error: 'Comment content is required' }, { status: 400 })
    }

    const { data: taskRow, error: taskError } = await supabaseAdmin
      .from('tasks')
      .select('id, metadata')
      .eq('id', taskId)
      .maybeSingle()
    if (taskError) throw taskError
    if (!taskRow) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const assignees = await resolveTaskAssignees(taskId)
    const canComment = authResult.user.role === 'admin' ||
      assignees.some((a) => a.id === authResult.user.profileId)
    if (!canComment) {
      return NextResponse.json({ error: 'Not authorized to comment on this task' }, { status: 403 })
    }

    const comment = {
      id: `${taskId}_${authResult.user.profileId}_${Date.now()}`,
      userId: authResult.user.profileId,
      userName: authResult.user.email || 'Unknown',
      content,
      createdAt: new Date(),
      attachments: attachments || []
    }

    const metadata = (taskRow.metadata || {}) as Record<string, unknown>
    const comments = Array.isArray(metadata.comments) ? [...(metadata.comments as unknown[]), comment] : [comment]
    const { error: updateError } = await supabaseAdmin
      .from('tasks')
      .update({
        metadata: {
          ...metadata,
          comments
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId)
    if (updateError) throw updateError

    return NextResponse.json({ comment })
  } catch (error) {
    console.error('Error adding comment:', error)
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: taskId } = await context.params
    const { data: taskRow, error: taskError } = await supabaseAdmin
      .from('tasks')
      .select('id, assigner_id')
      .eq('id', taskId)
      .maybeSingle()
    if (taskError) throw taskError
    if (!taskRow) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    if (taskRow.assigner_id !== authResult.user.profileId && authResult.user.role !== 'admin') {
      return NextResponse.json({ error: 'Not authorized to delete this task' }, { status: 403 })
    }

    await supabaseAdmin.from('task_assignees').delete().eq('task_id', taskId)
    await supabaseAdmin.from('task_records').delete().eq('task_id', taskId)
    const { error: deleteError } = await supabaseAdmin.from('tasks').delete().eq('id', taskId)
    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting task:', error)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}

