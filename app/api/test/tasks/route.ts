import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Task } from '@/types/task'

// POST /api/test/tasks - Create test tasks for scoring
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { taskType, count = 1 } = body

    const createdTasks = []

    for (let i = 0; i < count; i++) {
      let testTask: Partial<Task>

      switch (taskType) {
        case 'basic':
          testTask = {
            title: `Test Task ${i + 1}`,
            description: 'A basic test task for scoring',
            assignees: [{ id: authResult.user.profileId, name: authResult.user.email, type: 'user' }],
            assignerId: 'test-assigner',
            assignerName: 'Test Assigner',
            priority: 'medium',
            status: 'backlog',
            category: 'general',
            dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h from now
            estimatedHours: 4,
            difficulty: 'medium',
            productivityImpact: 'neutral',
            assignedAt: new Date()
          }
          break

        case 'high_priority':
          testTask = {
            title: `Urgent Task ${i + 1}`,
            description: 'A high priority test task',
            assignees: [{ id: authResult.user.profileId, name: authResult.user.email, type: 'user' }],
            assignerId: 'test-assigner',
            assignerName: 'Test Assigner',
            priority: 'urgent',
            status: 'backlog',
            category: 'general',
            dueDate: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12h from now
            estimatedHours: 2,
            difficulty: 'hard',
            productivityImpact: 'positive',
            assignedAt: new Date()
          }
          break

        case 'low_priority':
          testTask = {
            title: `Low Priority Task ${i + 1}`,
            description: 'A low priority test task',
            assignees: [{ id: authResult.user.profileId, name: authResult.user.email, type: 'user' }],
            assignerId: 'test-assigner',
            assignerName: 'Test Assigner',
            priority: 'low',
            status: 'backlog',
            category: 'general',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            estimatedHours: 8,
            difficulty: 'easy',
            productivityImpact: 'neutral',
            assignedAt: new Date()
          }
          break

        case 'overdue':
          testTask = {
            title: `Overdue Task ${i + 1}`,
            description: 'An overdue test task',
            assignees: [{ id: authResult.user.profileId, name: authResult.user.email, type: 'user' }],
            assignerId: 'test-assigner',
            assignerName: 'Test Assigner',
            priority: 'medium',
            status: 'in_progress',
            category: 'general',
            dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
            estimatedHours: 3,
            difficulty: 'medium',
            productivityImpact: 'negative',
            assignedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
            startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
          }
          break

        default:
          return NextResponse.json({ error: 'Invalid task type' }, { status: 400 })
      }

      // Add required fields
      const fullTask = {
        ...testTask,
        id: `test-task-${Date.now()}-${i}`,
        createdAt: new Date(),
        updatedAt: new Date()
      } as Task

      const { data: taskRow, error: taskError } = await supabaseAdmin
        .from('tasks')
        .insert({
          title: fullTask.title,
          description: fullTask.description,
          assigner_id: authResult.user.profileId,
          priority: fullTask.priority,
          status: fullTask.status,
          category: fullTask.category,
          due_date: fullTask.dueDate?.toISOString(),
          estimated_hours: fullTask.estimatedHours,
          metadata: {
            difficulty: fullTask.difficulty,
            productivityImpact: fullTask.productivityImpact,
            assignedAt: fullTask.assignedAt?.toISOString(),
            startedAt: fullTask.startedAt?.toISOString()
          }
        })
        .select('id')
        .single()

      if (taskError || !taskRow) {
        throw taskError
      }

      await supabaseAdmin.from('task_assignees').insert({
        task_id: taskRow.id,
        assignee_id: authResult.user.profileId,
        assignment_type: 'user'
      })

      createdTasks.push({ id: taskRow.id, ...fullTask })
    }

    return NextResponse.json({
      success: true,
      createdTasks,
      count: createdTasks.length,
      message: `Created ${createdTasks.length} test task(s) of type: ${taskType}`
    })

  } catch (error) {
    console.error('Error creating test tasks:', error)
    return NextResponse.json({ error: 'Failed to create test tasks' }, { status: 500 })
  }
}

// GET /api/test/tasks - Get available task types
export async function GET() {
  return NextResponse.json({
    availableTaskTypes: [
      {
        type: 'basic',
        description: 'Basic medium priority task',
        parameters: { count: 'number of tasks to create' }
      },
      {
        type: 'high_priority',
        description: 'High priority urgent task',
        parameters: { count: 'number of tasks to create' }
      },
      {
        type: 'low_priority',
        description: 'Low priority easy task',
        parameters: { count: 'number of tasks to create' }
      },
      {
        type: 'overdue',
        description: 'Overdue task for penalty testing',
        parameters: { count: 'number of tasks to create' }
      }
    ]
  })
}







