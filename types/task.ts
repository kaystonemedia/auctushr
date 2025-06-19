import { Timestamp } from 'firebase/firestore'

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'
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
}

export interface TaskComment {
  id: string
  userId: string
  userName: string
  content: string
  createdAt: Date
  attachments?: string[]
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

export interface TaskStats {
  total: number
  pending: number
  inProgress: number
  completed: number
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
} 