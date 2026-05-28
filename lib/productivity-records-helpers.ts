/** Maps API responses to/from `productivity_records` Supabase schema. */

export type ProductivityRecordRow = {
  id: string
  user_id: string
  date: string
  productivity_score: number | null
  focus_time_minutes: number | null
  meeting_time_minutes: number | null
  task_completion_rate: number | null
  metadata: Record<string, unknown> | null
  created_at?: string
}

export function toRecordDate(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10)
  }
  return date.toISOString().slice(0, 10)
}

export function mapProductivityRowToApi(row: ProductivityRecordRow) {
  const meta = (row.metadata || {}) as Record<string, unknown>
  const tasksCompleted = Number(meta.tasks_completed ?? 0)
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    blendedScore: Number(row.productivity_score ?? 0),
    taskCount: tasksCompleted,
    completedTasks: tasksCompleted,
    onTimeTasks: tasksCompleted,
    focusTime: Number(row.focus_time_minutes ?? 0),
  }
}

export function buildProductivityUpsert(params: {
  userId: string
  date: Date | string
  score: number
  tasksCompleted?: number
  focusMinutes?: number
  metadata?: Record<string, unknown>
}) {
  const tasksCompleted = params.tasksCompleted ?? 0
  return {
    user_id: params.userId,
    date: toRecordDate(params.date),
    productivity_score: params.score,
    focus_time_minutes: params.focusMinutes ?? 0,
    task_completion_rate: params.score,
    metadata: {
      ...params.metadata,
      tasks_completed: tasksCompleted,
    },
  }
}

export function getTasksCompletedFromRow(row: ProductivityRecordRow): number {
  const meta = (row.metadata || {}) as Record<string, unknown>
  return Number(meta.tasks_completed ?? 0)
}
