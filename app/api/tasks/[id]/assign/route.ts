import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TaskAssignee } from '@/types/task'

type RouteContext = { params: Promise<{ id: string }> }

async function resolveProfileId(idOrUid: string) {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .or(`id.eq.${idOrUid},auth_user_id.eq.${idOrUid}`)
    .maybeSingle()
  return data?.id || null
}

// POST /api/tasks/[id]/assign - Assign task to users
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id: taskId } = await context.params
    const { assignees, message } = body

    if (!assignees || !Array.isArray(assignees)) {
      return NextResponse.json({ error: 'Assignees are required' }, { status: 400 })
    }

    const { data: taskRow, error: taskError } = await supabaseAdmin
      .from('tasks')
      .select('id, assigner_id')
      .eq('id', taskId)
      .maybeSingle()
    if (taskError) throw taskError
    if (!taskRow) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Check permissions (only assigner can reassign)
    if (taskRow.assigner_id !== authResult.user.profileId && authResult.user.role !== 'admin') {
      return NextResponse.json({ error: 'Not authorized to assign this task' }, { status: 403 })
    }

    const updatedAssignees = assignees.map((assignee: { id: string; name?: string; type?: string; department?: string }) => ({
      id: assignee.id,
      name: assignee.name || 'User',
      type: assignee.type || 'user',
      department: assignee.department
    })) as TaskAssignee[]

    await supabaseAdmin.from('task_assignees').delete().eq('task_id', taskId)
    const links: Array<{ task_id: string; assignee_id: string; assignment_type: string }> = []
    for (const assignee of updatedAssignees) {
      const profileId = await resolveProfileId(assignee.id)
      if (!profileId) continue
      links.push({
        task_id: taskId,
        assignee_id: profileId,
        assignment_type: assignee.type || 'user'
      })
    }
    if (links.length > 0) {
      await supabaseAdmin.from('task_assignees').insert(links)
    }

    await supabaseAdmin
      .from('tasks')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', taskId)

    await supabaseAdmin.from('task_records').insert({
      task_id: taskId,
      user_id: authResult.user.profileId,
      action: 'assigned',
      notes: message || 'Task reassigned'
    })

    // Send assignment notifications
    await sendTaskAssignmentNotifications(taskId, links.map((l) => l.assignee_id), authResult.user.email || 'Manager', message)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error assigning task:', error)
    return NextResponse.json({ error: 'Failed to assign task' }, { status: 500 })
  }
}

// POST /api/tasks/[id]/accept - Accept task assignment
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id: taskId } = await context.params
    const { notes } = body

    const { data: taskRow, error: taskError } = await supabaseAdmin
      .from('tasks')
      .select('id, assigner_id, status')
      .eq('id', taskId)
      .maybeSingle()
    if (taskError) throw taskError
    if (!taskRow) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Check if user is assigned to this task
    const { data: links } = await supabaseAdmin
      .from('task_assignees')
      .select('assignee_id')
      .eq('task_id', taskId)
      .eq('assignee_id', authResult.user.profileId)
      .limit(1)
    const isAssignee = !!links && links.length > 0
    if (!isAssignee) {
      return NextResponse.json({ error: 'You are not assigned to this task' }, { status: 403 })
    }

    // Update task status to accepted
    await supabaseAdmin
      .from('tasks')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', taskId)

    // Create task record
    await supabaseAdmin.from('task_records').insert({
      taskId,
      user_id: authResult.user.profileId,
      action: 'accepted',
      notes: notes || 'Task accepted'
    })

    // Send notification to assigner
    await sendTaskAcceptanceNotification(taskId, taskRow.assigner_id, authResult.user.email || 'Assignee')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error accepting task:', error)
    return NextResponse.json({ error: 'Failed to accept task' }, { status: 500 })
  }
}

// POST /api/tasks/[id]/reject - Reject task assignment
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id: taskId } = await context.params
    const { reason } = body

    const { data: taskRow, error: taskError } = await supabaseAdmin
      .from('tasks')
      .select('id, assigner_id')
      .eq('id', taskId)
      .maybeSingle()
    if (taskError) throw taskError
    if (!taskRow) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Check if user is assigned to this task
    const { data: links } = await supabaseAdmin
      .from('task_assignees')
      .select('assignee_id')
      .eq('task_id', taskId)
      .eq('assignee_id', authResult.user.profileId)
      .limit(1)
    const isAssignee = !!links && links.length > 0
    if (!isAssignee) {
      return NextResponse.json({ error: 'You are not assigned to this task' }, { status: 403 })
    }

    await supabaseAdmin
      .from('task_assignees')
      .delete()
      .eq('task_id', taskId)
      .eq('assignee_id', authResult.user.profileId)

    await supabaseAdmin
      .from('tasks')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', taskId)

    // Create task record
    await supabaseAdmin.from('task_records').insert({
      taskId,
      user_id: authResult.user.profileId,
      action: 'cancelled',
      notes: reason || 'Task rejected'
    })

    // Send notification to assigner
    await sendTaskRejectionNotification(taskId, taskRow.assigner_id, authResult.user.email || 'Assignee', reason)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error rejecting task:', error)
    return NextResponse.json({ error: 'Failed to reject task' }, { status: 500 })
  }
}

// Helper function to send task assignment notifications
async function sendTaskAssignmentNotifications(
  taskId: string, 
  assigneeProfileIds: string[],
  assignerName: string, 
  message?: string
) {
  try {
    if (assigneeProfileIds.length === 0) return
    await supabaseAdmin.from('notifications').insert(
      assigneeProfileIds.map((assigneeId) => ({
        user_id: assigneeId,
        type: 'task_assigned',
        title: 'New Task Assigned',
        message: message || `You have been assigned a new task by ${assignerName}`,
        data: { taskId },
        read: false,
        severity: 'info'
      }))
    )
  } catch (error) {
    console.error('Error sending task assignment notifications:', error)
  }
}

// Helper function to send task acceptance notification
async function sendTaskAcceptanceNotification(taskId: string, assignerId: string, assigneeName: string) {
  try {
    await supabaseAdmin.from('notifications').insert({
      user_id: assignerId,
      type: 'task_accepted',
      title: 'Task Accepted',
      message: `${assigneeName} has accepted the task`,
      data: { taskId },
      read: false,
      severity: 'info'
    })
  } catch (error) {
    console.error('Error sending task acceptance notification:', error)
  }
}

// Helper function to send task rejection notification
async function sendTaskRejectionNotification(
  taskId: string, 
  assignerId: string, 
  assigneeName: string, 
  reason?: string
) {
  try {
    await supabaseAdmin.from('notifications').insert({
      user_id: assignerId,
      type: 'task_rejected',
      title: 'Task Rejected',
      message: `${assigneeName} has rejected the task${reason ? `: ${reason}` : ''}`,
      data: { taskId },
      read: false,
      severity: 'warning'
    })
  } catch (error) {
    console.error('Error sending task rejection notification:', error)
  }
}







