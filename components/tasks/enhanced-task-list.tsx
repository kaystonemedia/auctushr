"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Clock, CheckCircle2, Play, Pause, Flag, MessageSquare, Paperclip, Award, Star, MoreHorizontal } from "lucide-react"
import { Task, TaskPriority, TaskStatus } from "@/types/task"
import { format } from "date-fns"

const priorityColors = {
  low: "bg-blue-100 text-blue-800 border-blue-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  urgent: "bg-red-100 text-red-800 border-red-200",
}

const statusColors = {
  pending: "bg-gray-100 text-gray-800",
  accepted: "bg-purple-100 text-purple-800",
  in_progress: "bg-blue-100 text-blue-800",
  in_review: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  blocked: "bg-red-100 text-red-800"
}

interface EnhancedTaskListProps {
  tasks: Task[]
  onTaskSelect: (task: Task) => void
  onTaskUpdate: (task: Task) => void
  onTaskDelete: (taskId: string) => void
  loading?: boolean
}

export function EnhancedTaskList({ tasks, onTaskSelect, onTaskUpdate, onTaskDelete, loading = false }: EnhancedTaskListProps) {
  const [starredTasks, setStarredTasks] = useState<Set<string>>(new Set())

  const handleStarToggle = (taskId: string) => {
    setStarredTasks(prev => {
      const newSet = new Set(prev)
      if (newSet.has(taskId)) {
        newSet.delete(taskId)
      } else {
        newSet.add(taskId)
      }
      return newSet
    })
  }

  const handleStatusChange = async (task: Task, newStatus: TaskStatus) => {
    // This would integrate with your existing status change logic
    const updatedTask = { ...task, status: newStatus }
    onTaskUpdate(updatedTask)
  }

  const getTaskProgress = (task: Task) => {
    if (!task.actualHours || !task.estimatedHours) return 0
    return Math.min((task.actualHours / task.estimatedHours) * 100, 100)
  }

  const formatStatus = (status: TaskStatus) => {
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const isOverdue = (dueDate: Date) => {
    return new Date(dueDate) < new Date() && !tasks.find(t => t.id === tasks.find(t => t.dueDate === dueDate)?.id)?.completedAt
  }

  const isDueSoon = (dueDate: Date) => {
    const today = new Date()
    const due = new Date(dueDate)
    const diffTime = due.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays <= 2 && diffDays >= 0
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
        <p className="text-lg font-medium">No tasks found</p>
        <p className="text-sm">Create your first task to get started</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {tasks.map((task) => {
        const progress = getTaskProgress(task)
        const overdue = isOverdue(task.dueDate)
        const dueSoon = isDueSoon(task.dueDate)
        
        return (
          <Card
            key={task.id}
            className="hover:shadow-md transition-all duration-200 cursor-pointer group"
            onClick={() => onTaskSelect(task)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-sm font-[family-name:var(--font-montserrat)] truncate">
                      {task.title}
                    </h3>
                    {task.status === "completed" && <Award className="w-4 h-4 text-accent flex-shrink-0" />}
                    {starredTasks.has(task.id) && <Star className="w-4 h-4 text-accent fill-current flex-shrink-0" />}
                    {overdue && <Clock className="w-4 h-4 text-red-500 flex-shrink-0" />}
                  </div>

                  {task.description && (
                    <p className="text-sm text-muted-foreground mb-3 font-[family-name:var(--font-open-sans)] line-clamp-2">
                      {task.description}
                    </p>
                  )}

                  <div className="flex items-center gap-4 mb-3">
                    <Badge variant="outline" className={priorityColors[task.priority as keyof typeof priorityColors]}>
                      <Flag className="w-3 h-3 mr-1" />
                      {task.priority}
                    </Badge>

                    <Badge variant="secondary" className={statusColors[task.status as keyof typeof statusColors]}>
                      {formatStatus(task.status)}
                    </Badge>

                    <div className={`flex items-center gap-1 text-sm ${
                      overdue ? 'text-red-600' : dueSoon ? 'text-orange-600' : 'text-muted-foreground'
                    }`}>
                      <Clock className="w-3 h-3" />
                      {overdue ? 'Overdue' : dueSoon ? 'Due soon' : format(task.dueDate, 'MMM d')}
                    </div>
                  </div>

                  {/* Tags/Badges */}
                  {task.category && (
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline" className="text-xs">
                        {task.category}
                      </Badge>
                    </div>
                  )}

                  {/* Progress Bar */}
                  {progress > 0 && task.status !== "completed" && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={task.assignees?.[0]?.avatar || "/placeholder.svg"} />
                        <AvatarFallback className="text-xs">
                          {task.assignees?.[0]?.name
                            ?.split(" ")
                            .map((n) => n[0])
                            .join("") || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-muted-foreground font-[family-name:var(--font-open-sans)]">
                        {task.assignees?.[0]?.name || "Unassigned"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {task.comments && task.comments.length > 0 && (
                        <MessageSquare className="w-4 h-4 text-muted-foreground" />
                      )}
                      {task.attachments && task.attachments.length > 0 && (
                        <Paperclip className="w-4 h-4 text-muted-foreground" />
                      )}
                      {task.estimatedHours && (
                        <span className="text-xs text-muted-foreground">
                          {task.actualHours || 0}h / {task.estimatedHours}h
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleStarToggle(task.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Star className={`w-4 h-4 ${starredTasks.has(task.id) ? 'text-accent fill-current' : 'text-muted-foreground'}`} />
                  </Button>
                  
                  {task.status === "in_progress" && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleStatusChange(task, "completed")
                      }}
                    >
                      <Pause className="w-3 h-3" />
                    </Button>
                  )}
                  {task.status === "pending" && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleStatusChange(task, "accepted")
                      }}
                    >
                      <Play className="w-3 h-3" />
                    </Button>
                  )}
                  {task.status === "accepted" && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleStatusChange(task, "in_progress")
                      }}
                    >
                      <Play className="w-3 h-3" />
                    </Button>
                  )}
                  {task.status === "in_review" && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleStatusChange(task, "completed")
                      }}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                    </Button>
                  )}
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => e.stopPropagation()}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
