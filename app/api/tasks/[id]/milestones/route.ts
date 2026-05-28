import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TaskMilestone } from '@/types/task'

type RouteContext = { params: Promise<{ id: string }> }

// POST /api/tasks/[id]/milestones - Add milestone to task
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id: taskId } = await context.params
    const { title, description, dueDate } = body

    if (!title || !dueDate) {
      return NextResponse.json({ error: 'Title and due date are required' }, { status: 400 })
    }

    const { data: taskRow, error: taskError } = await supabaseAdmin
      .from('tasks')
      .select('id, assigner_id, metadata')
      .eq('id', taskId)
      .maybeSingle()
    if (taskError) throw taskError
    if (!taskRow) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Check permissions
    const { data: links } = await supabaseAdmin
      .from('task_assignees')
      .select('assignee_id')
      .eq('task_id', taskId)
      .eq('assignee_id', authResult.user.profileId)
      .limit(1)
    const isAssigner = taskRow.assigner_id === authResult.user.profileId
    const isAssignee = !!links && links.length > 0
    
    if (!isAssigner && !isAssignee) {
      return NextResponse.json({ error: 'Not authorized to modify this task' }, { status: 403 })
    }

    const milestone: TaskMilestone = {
      id: `${taskId}_${Date.now()}`,
      title,
      description: description || '',
      dueDate: new Date(dueDate),
      progress: 0,
      isCompleted: false
    }

    const metadata = (taskRow.metadata || {}) as Record<string, unknown>
    const milestones = Array.isArray(metadata.milestones) ? [...(metadata.milestones as TaskMilestone[]), milestone] : [milestone]
    await supabaseAdmin
      .from('tasks')
      .update({
        metadata: { ...metadata, milestones },
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId)

    return NextResponse.json({ milestone })
  } catch (error) {
    console.error('Error adding milestone:', error)
    return NextResponse.json({ error: 'Failed to add milestone' }, { status: 500 })
  }
}

// PUT /api/tasks/[id]/milestones/[milestoneId] - Update milestone
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id: taskId } = await context.params
    const milestoneId = body.milestoneId as string
    const { progress, isCompleted, title, description, dueDate } = body
    if (!milestoneId) {
      return NextResponse.json({ error: 'milestoneId is required' }, { status: 400 })
    }

    const { data: taskRow, error: taskError } = await supabaseAdmin
      .from('tasks')
      .select('id, assigner_id, metadata')
      .eq('id', taskId)
      .maybeSingle()
    if (taskError) throw taskError
    if (!taskRow) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Check permissions
    const { data: links } = await supabaseAdmin
      .from('task_assignees')
      .select('assignee_id')
      .eq('task_id', taskId)
      .eq('assignee_id', authResult.user.profileId)
      .limit(1)
    const isAssigner = taskRow.assigner_id === authResult.user.profileId
    const isAssignee = !!links && links.length > 0
    
    if (!isAssigner && !isAssignee) {
      return NextResponse.json({ error: 'Not authorized to modify this task' }, { status: 403 })
    }

    // Find and update milestone
    const metadata = (taskRow.metadata || {}) as Record<string, unknown>
    const milestones = Array.isArray(metadata.milestones) ? [...(metadata.milestones as TaskMilestone[])] : []
    const milestoneIndex = milestones.findIndex(m => m.id === milestoneId)
    
    if (milestoneIndex === -1) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
    }

    const updatedMilestone = {
      ...milestones[milestoneIndex],
      progress: progress !== undefined ? progress : milestones[milestoneIndex].progress,
      isCompleted: isCompleted !== undefined ? isCompleted : milestones[milestoneIndex].isCompleted,
      title: title || milestones[milestoneIndex].title,
      description: description || milestones[milestoneIndex].description,
      dueDate: dueDate ? new Date(dueDate) : milestones[milestoneIndex].dueDate,
      completedAt: isCompleted && !milestones[milestoneIndex].isCompleted ? new Date() : milestones[milestoneIndex].completedAt
    }

    milestones[milestoneIndex] = updatedMilestone

    // Update task with modified milestones
    await supabaseAdmin
      .from('tasks')
      .update({
        metadata: { ...metadata, milestones },
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId)

    // Calculate overall task progress
    await updateTaskProgress(taskId, milestones)

    return NextResponse.json({ milestone: updatedMilestone })
  } catch (error) {
    console.error('Error updating milestone:', error)
    return NextResponse.json({ error: 'Failed to update milestone' }, { status: 500 })
  }
}

// DELETE /api/tasks/[id]/milestones/[milestoneId] - Delete milestone
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: taskId } = await context.params
    const { searchParams } = new URL(request.url)
    const milestoneId = searchParams.get('milestoneId')
    if (!milestoneId) {
      return NextResponse.json({ error: 'milestoneId is required' }, { status: 400 })
    }

    const { data: taskRow, error: taskError } = await supabaseAdmin
      .from('tasks')
      .select('id, assigner_id, metadata')
      .eq('id', taskId)
      .maybeSingle()
    if (taskError) throw taskError
    if (!taskRow) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Check permissions (only assigner can delete milestones)
    if (taskRow.assigner_id !== authResult.user.profileId && authResult.user.role !== 'admin') {
      return NextResponse.json({ error: 'Not authorized to delete milestones' }, { status: 403 })
    }

    const metadata = (taskRow.metadata || {}) as Record<string, unknown>
    const milestones = Array.isArray(metadata.milestones) ? [...(metadata.milestones as TaskMilestone[])] : []
    const milestoneToRemove = milestones.find(m => m.id === milestoneId)
    
    if (!milestoneToRemove) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
    }

    const remainingMilestones = milestones.filter(m => m.id !== milestoneId)
    await supabaseAdmin
      .from('tasks')
      .update({
        metadata: { ...metadata, milestones: remainingMilestones },
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId)

    // Recalculate task progress
    await updateTaskProgress(taskId, remainingMilestones)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting milestone:', error)
    return NextResponse.json({ error: 'Failed to delete milestone' }, { status: 500 })
  }
}

// Helper function to update task progress based on milestones
async function updateTaskProgress(taskId: string, milestones: TaskMilestone[]) {
  if (milestones.length === 0) {
    await supabaseAdmin.from('tasks').update({ progress: 0 }).eq('id', taskId)
    return
  }

  const totalProgress = milestones.reduce((sum, milestone) => sum + milestone.progress, 0)
  const averageProgress = Math.round(totalProgress / milestones.length)

  await supabaseAdmin.from('tasks').update({ progress: averageProgress }).eq('id', taskId)
}







