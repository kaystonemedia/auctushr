'use client'

import { Task, TaskStats as TaskStatsType, TaskPriority, TaskCategory } from '@/types/task'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'

interface TaskStatsProps {
  tasks: Task[]
}

export function TaskStats({ tasks }: TaskStatsProps) {
  const stats = calculateStats(tasks)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Task Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Tasks</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Completion Rate</p>
              <p className="text-2xl font-bold">
                {stats.onTimeCompletionRate ? `${Math.round(stats.onTimeCompletionRate)}%` : 'N/A'}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Status Distribution</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Pending</span>
                <span className="text-sm font-medium">{stats.pending}</span>
              </div>
              <Progress value={stats.total > 0 ? (stats.pending / stats.total) * 100 : 0} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">In Progress</span>
                <span className="text-sm font-medium">{stats.inProgress}</span>
              </div>
              <Progress value={stats.total > 0 ? (stats.inProgress / stats.total) * 100 : 0} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Completed</span>
                <span className="text-sm font-medium">{stats.completed}</span>
              </div>
              <Progress value={stats.total > 0 ? (stats.completed / stats.total) * 100 : 0} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Cancelled</span>
                <span className="text-sm font-medium">{stats.cancelled}</span>
              </div>
              <Progress value={stats.total > 0 ? (stats.cancelled / stats.total) * 100 : 0} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Priority Distribution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(stats.byPriority).map(([priority, count]) => (
            <div key={priority} className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge className={getPriorityColor(priority as TaskPriority)}>
                  {priority}
                </Badge>
                <span className="text-sm font-medium">{count}</span>
              </div>
              <Progress value={stats.total > 0 ? (count / stats.total) * 100 : 0} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Category Distribution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(stats.byCategory).map(([category, count]) => (
            <div key={category} className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="outline">
                  {category}
                </Badge>
                <span className="text-sm font-medium">{count}</span>
              </div>
              <Progress value={stats.total > 0 ? (count / stats.total) * 100 : 0} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      {stats.averageCompletionTime && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Average Completion Time</p>
                <p className="text-2xl font-bold">{Math.round(stats.averageCompletionTime)} hours</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function calculateStats(tasks: Task[]): TaskStatsType {
  const stats: TaskStatsType = {
    total: tasks.length,
    pending: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
    byPriority: {
      low: 0,
      medium: 0,
      high: 0,
      urgent: 0
    },
    byCategory: {
      general: 0,
      development: 0,
      design: 0,
      marketing: 0,
      support: 0,
      other: 0
    }
  }

  let totalCompletionTime = 0
  let completedTasks = 0
  let onTimeTasks = 0

  tasks.forEach(task => {
    // Count by status
    stats[task.status]++

    // Count by priority
    stats.byPriority[task.priority]++

    // Count by category
    stats.byCategory[task.category]++

    // Calculate completion time and on-time rate
    if (task.status === 'completed' && task.completedAt && task.actualHours) {
      const completionTime = task.actualHours
      totalCompletionTime += completionTime
      completedTasks++

      // Check if task was completed on time
      if (task.completedAt <= task.dueDate) {
        onTimeTasks++
      }
    }
  })

  // Calculate average completion time
  if (completedTasks > 0) {
    stats.averageCompletionTime = totalCompletionTime / completedTasks
  }

  // Calculate on-time completion rate
  if (completedTasks > 0) {
    stats.onTimeCompletionRate = (onTimeTasks / completedTasks) * 100
  }

  return stats
}

function getPriorityColor(priority: TaskPriority): string {
  switch (priority) {
    case 'low': return 'bg-gray-100 text-gray-800'
    case 'medium': return 'bg-blue-100 text-blue-800'
    case 'high': return 'bg-orange-100 text-orange-800'
    case 'urgent': return 'bg-red-100 text-red-800'
    default: return 'bg-gray-100 text-gray-800'
  }
} 