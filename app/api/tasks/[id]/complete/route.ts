import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

type RouteContext = { params: Promise<{ id: string }> }

// POST /api/tasks/[id]/complete - Complete task and update payroll
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id: taskId } = await context.params
    const { actualHours, notes, productivityImpact } = body

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

    const { data: linkRows } = await supabaseAdmin
      .from('task_assignees')
      .select('assignee_id')
      .eq('task_id', taskId)
      .eq('assignee_id', authResult.user.profileId)
      .limit(1)
    const isAssignee = !!linkRows && linkRows.length > 0
    if (!isAssignee) {
      return NextResponse.json({ error: 'You are not assigned to this task' }, { status: 403 })
    }

    const metadata = (taskRow.metadata || {}) as Record<string, unknown>
    const updatedMetadata = {
      ...metadata,
      productivityImpact: productivityImpact || metadata.productivityImpact || 'neutral'
    }

    const { error: updateError } = await supabaseAdmin
      .from('tasks')
      .update({
        status: 'completed',
        completed_at: now.toISOString(),
        actual_hours: actualHours || null,
        updated_at: now.toISOString(),
        metadata: updatedMetadata
      })
      .eq('id', taskId)
    if (updateError) throw updateError

    await supabaseAdmin.from('task_records').insert({
      task_id: taskId,
      user_id: authResult.user.profileId,
      action: 'completed',
      notes: notes || 'Task completed',
      productivity_score: null,
      metadata: {
        actualHours: actualHours || null,
        productivityImpact: updatedMetadata.productivityImpact
      }
    })

    // Send completion notification
    await supabaseAdmin.from('notifications').insert({
      user_id: taskRow.assigner_id,
      type: 'task_completed',
      title: 'Task Completed',
      message: `${authResult.user.email || 'A user'} has completed the task: ${taskRow.title}`,
      data: { taskId, completedBy: authResult.user.profileId },
      read: false,
      severity: 'info'
    })

    return NextResponse.json({ 
      success: true,
      message: 'Task completed successfully'
    })
  } catch (error) {
    console.error('Error completing task:', error)
    return NextResponse.json({ error: 'Failed to complete task' }, { status: 500 })
  }
}

