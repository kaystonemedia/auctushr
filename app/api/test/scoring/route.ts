import { NextRequest, NextResponse } from 'next/server'
import { productivityScoringService } from '@/lib/productivity-scoring'
import { Task, TaskPriority, ProductivityEvent } from '@/types/task'
import { requireRole } from '@/lib/api-auth'

type TestResult = Record<string, unknown>
type EventAction = ProductivityEvent['action']

// POST /api/test/scoring - Test the scoring engine
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['admin'])
  if (auth.error) return auth.error
  const user = auth.user

  try {
    const body = await request.json()
    const { testType, taskData, eventType } = body

    const testTask: Task = {
      id: 'test-task-123',
      title: taskData?.title || 'Test Task',
      description: 'Testing the scoring engine',
      assignees: [{ id: user.uid, name: user.email || 'Test User', type: 'user' }],
      assignerId: 'test-assigner',
      assignerName: 'Test Assigner',
      priority: taskData?.priority || 'medium',
      status: taskData?.status || 'in_progress',
      category: 'general',
      dueDate: taskData?.dueDate ? new Date(taskData.dueDate) : new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
      estimatedHours: taskData?.estimatedHours || 4,
      actualHours: taskData?.actualHours,
      difficulty: taskData?.difficulty || 'medium',
      productivityImpact: taskData?.productivityImpact || 'neutral',
      assignedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      startedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      completedAt: taskData?.completedAt ? new Date(taskData.completedAt) : undefined
    }

    let result: TestResult = {}

    switch (testType) {
      case 'single_event': {
        const { scoreChange, reasons } = await productivityScoringService.applyTaskEventDelta(
          user.uid,
          testTask,
          (eventType as EventAction) || 'completed'
        )
        result = { scoreChange, reasons, task: testTask }
        break
      }

      case 'multiple_events': {
        const events: EventAction[] = ['accepted', 'started', 'completed']
        const eventResults: Array<{ event: EventAction; scoreChange: number; reasons: string[] }> = []

        for (const event of events) {
          const { scoreChange, reasons } = await productivityScoringService.applyTaskEventDelta(
            user.uid,
            testTask,
            event
          )
          eventResults.push({ event, scoreChange, reasons })
        }

        result = { events: eventResults, totalScore: eventResults.reduce((sum, e) => sum + e.scoreChange, 0) }
        break
      }

      case 'priority_test': {
        const priorities: TaskPriority[] = ['low', 'medium', 'high', 'urgent']
        const priorityResults: Array<{ priority: TaskPriority; scoreChange: number; reasons: string[] }> = []

        for (const priority of priorities) {
          const taskWithPriority = { ...testTask, priority }
          const { scoreChange, reasons } = await productivityScoringService.applyTaskEventDelta(
            user.uid,
            taskWithPriority,
            'completed'
          )
          priorityResults.push({ priority, scoreChange, reasons })
        }

        result = { priorityResults }
        break
      }

      case 'difficulty_test': {
        const difficulties: Array<'easy' | 'medium' | 'hard'> = ['easy', 'medium', 'hard']
        const difficultyResults: Array<{ difficulty: string; scoreChange: number; reasons: string[] }> = []

        for (const difficulty of difficulties) {
          const taskWithDifficulty: Task = { ...testTask, difficulty }
          const { scoreChange, reasons } = await productivityScoringService.applyTaskEventDelta(
            user.uid,
            taskWithDifficulty,
            'completed'
          )
          difficultyResults.push({ difficulty, scoreChange, reasons })
        }

        result = { difficultyResults }
        break
      }

      case 'timing_test': {
        const timingScenarios = [
          { name: 'On Time', completedAt: new Date(testTask.dueDate.getTime() - 60 * 60 * 1000) },
          { name: 'Late', completedAt: new Date(testTask.dueDate.getTime() + 24 * 60 * 60 * 1000) },
          { name: 'Very Early', completedAt: new Date(testTask.dueDate.getTime() - 48 * 60 * 60 * 1000) }
        ]

        const timingResults: Array<{ scenario: string; scoreChange: number; reasons: string[] }> = []

        for (const scenario of timingScenarios) {
          const taskWithTiming = { ...testTask, completedAt: scenario.completedAt }
          const { scoreChange, reasons } = await productivityScoringService.applyTaskEventDelta(
            user.uid,
            taskWithTiming,
            'completed'
          )
          timingResults.push({ scenario: scenario.name, scoreChange, reasons })
        }

        result = { timingResults }
        break
      }

      default:
        return NextResponse.json({ error: 'Invalid test type' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      testType,
      result,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error testing scoring engine:', error)
    return NextResponse.json({ error: 'Failed to test scoring engine' }, { status: 500 })
  }
}

// GET /api/test/scoring - Get available test types
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['admin'])
  if (auth.error) return auth.error

  return NextResponse.json({
    availableTests: [
      {
        type: 'single_event',
        description: 'Test a single event scoring',
        parameters: { eventType: 'accepted|started|completed|blocked|reopened' }
      },
      {
        type: 'multiple_events',
        description: 'Test multiple events in sequence',
        parameters: {}
      },
      {
        type: 'priority_test',
        description: 'Test scoring with different priorities',
        parameters: {}
      },
      {
        type: 'difficulty_test',
        description: 'Test scoring with different difficulties',
        parameters: {}
      },
      {
        type: 'timing_test',
        description: 'Test scoring with different completion times',
        parameters: {}
      }
    ]
  })
}
