export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskStatus = 'backlog' | 'accepted' | 'in_progress' | 'in_review' | 'completed' | 'blocked' | 'cancelled'
export type TaskCategory = 'general' | 'development' | 'design' | 'marketing' | 'support' | 'other'
export type TaskAssignmentType = 'user' | 'department' | 'team'

export interface TaskAssignee {
  id: string
  name: string
  type: TaskAssignmentType
  department?: string
}

export interface Task {
  id: string
  title: string
  description: string
  assignees: TaskAssignee[]
  assignerId: string
  assignerName: string
  department?: string
  priority: TaskPriority
  status: TaskStatus
  category: TaskCategory
  dueDate: Date
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
  attachments?: string[]
  comments?: TaskComment[]
  estimatedHours?: number
  actualHours?: number
  progress?: number
  // Enhanced features
  milestones?: TaskMilestone[]
  dependencies?: string[] // Task IDs this task depends on
  subtasks?: string[] // Task IDs of subtasks
  parentTaskId?: string // Parent task ID if this is a subtask
  tags?: string[]
  starred?: boolean
  productivityImpact?: 'positive' | 'negative' | 'neutral'
  difficulty?: 'easy' | 'medium' | 'hard'
  timeTracking?: {
    startTime?: Date
    pausedTime?: Date
    totalPausedDuration?: number // in milliseconds
  }
  // Additional fields for comprehensive tracking
  projectId?: string
  watchers?: string[] // User IDs who should receive notifications
  // Detailed timestamps for better tracking
  assignedAt?: Date
  acceptedAt?: Date
  startedAt?: Date
  inReviewAt?: Date
  blockedAt?: Date
  cancelledAt?: Date
  // Time tracking subcollection reference
  timeEntries?: TimeEntry[]
}

export interface TaskComment {
  id: string
  userId: string
  userName: string
  content: string
  createdAt: Date
  attachments?: string[]
}

export interface TimeEntry {
  id: string
  taskId: string
  userId: string
  startTime: Date
  endTime?: Date
  duration?: number // in milliseconds
  description?: string
  createdAt: Date
  updatedAt: Date
}

export interface TaskFilter {
  status?: TaskStatus[]
  priority?: TaskPriority[]
  category?: TaskCategory[]
  assigneeId?: string
  department?: string
  assignerId?: string
  startDate?: Date
  endDate?: Date
  search?: string
  assignmentType?: TaskAssignmentType
}

export interface TaskMilestone {
  id: string
  title: string
  description?: string
  dueDate: Date
  completedAt?: Date
  progress: number // 0-100
  isCompleted: boolean
}

export interface TaskRecord {
  id: string
  taskId: string
  userId: string
  action: 'assigned' | 'accepted' | 'started' | 'paused' | 'resumed' | 'completed' | 'cancelled' | 'blocked'
  timestamp: Date
  notes?: string
  productivityScore?: number
}

export interface ProductivityScore {
  id: string
  userId: string
  date: Date
  taskScore: number
  monitoringScore: number
  blendedScore: number
  taskCount: number
  completedTasks: number
  onTimeTasks: number
  overdueTasks: number
  averageCompletionTime: number
  focusTime: number
  breakTime: number
  streak: number
  badges: string[]
  level: number
  experience: number
}

export interface ProductivityEvent {
  id: string
  userId: string
  taskId: string
  action: 'assigned' | 'accepted' | 'started' | 'moved_to_review' | 'completed' | 'reopened' | 'blocked' | 'unblocked' | 'overdue_tick' | 'on_time_bonus' | 'early_bonus' | 'time_drift_penalty'
  timestamp: Date
  scoreChange: number
  meta?: {
    priority?: TaskPriority
    estimatedHours?: number
    actualHours?: number
    difficulty?: 'easy' | 'medium' | 'hard'
    productivityImpact?: 'positive' | 'negative' | 'neutral'
    isOnTime?: boolean
    isEarly?: boolean
    daysOverdue?: number
    timeDrift?: number
  }
  reasons: string[]
}

export interface ProductivityDaily {
  id: string
  userId: string
  date: string // YYYY-MM-DD format
  taskScore: number
  monitoringScore: number
  blendedScore: number
  aggregates: {
    taskCount: number
    completedTasks: number
    onTimeTasks: number
    overdueTasks: number
    blockedTasks: number
    averageCompletionTime: number
    totalHours: number
    focusTime: number
    breakTime: number
  }
  streak: number
  badges: string[]
  level: number
  experience: number
  updatedAt: Date
}

export interface Goal {
  id: string
  userId: string
  title: string
  description: string
  type: 'daily' | 'weekly' | 'monthly' | 'custom'
  target: number
  current: number
  unit: string
  startDate: Date
  endDate: Date
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface TaskStats {
  total: number
  backlog: number
  accepted: number
  inProgress: number
  inReview: number
  completed: number
  blocked: number
  cancelled: number
  byPriority: {
    low: number
    medium: number
    high: number
    urgent: number
  }
  byCategory: {
    [key in TaskCategory]: number
  }
  averageCompletionTime?: number // in hours
  onTimeCompletionRate?: number // percentage
  productivityImpact: {
    positive: number
    negative: number
    neutral: number
  }
  difficulty: {
    easy: number
    medium: number
    hard: number
  }
}

export interface ScoringWeights {
  // Priority multipliers
  priorityWeights: {
    low: number
    medium: number
    high: number
    urgent: number
  }
  // Action scores
  actionScores: {
    accept: number
    startWithin24h: number
    completeBase: number
    onTimeBonus: number
    earlyBonus: number
    overduePenalty: number
    reopenPenalty: number
    blockedPenalty: number
    timeDriftPenalty: number
  }
  // Blending weights
  blendingWeights: {
    monitoring: number
    task: number
  }
  // Difficulty multipliers
  difficultyMultipliers: {
    easy: number
    medium: number
    hard: number
  }
  // Productivity impact multipliers
  productivityImpactMultipliers: {
    positive: number
    negative: number
    neutral: number
  }
} 