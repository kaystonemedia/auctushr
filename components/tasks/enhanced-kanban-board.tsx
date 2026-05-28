"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Plus, Flag, Clock, MessageSquare, Paperclip, Award, Star } from "lucide-react"
import { Task, TaskPriority, TaskStatus } from "@/types/task"
import { format } from "date-fns"

const columns = [
  { id: "pending", title: "Backlog", color: "bg-gray-50 border-gray-200" },
  { id: "accepted", title: "Accepted", color: "bg-purple-50 border-purple-200" },
  { id: "in_progress", title: "In Progress", color: "bg-blue-50 border-blue-200" },
  { id: "in_review", title: "In Review", color: "bg-purple-50 border-purple-200" },
  { id: "completed", title: "Completed", color: "bg-green-50 border-green-200" },
]

const priorityColors = {
  low: "bg-blue-100 text-blue-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800",
}

interface EnhancedKanbanBoardProps {
  tasks: Task[]
  onTaskSelect: (task: Task) => void
  onTaskUpdate?: (task: Task) => void
  loading?: boolean
}

export function EnhancedKanbanBoard({ tasks, onTaskSelect, onTaskUpdate, loading = false }: EnhancedKanbanBoardProps) {
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)
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

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const handleDrop = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault()
    if (draggedTask && onTaskUpdate) {
      const updatedTask = { ...draggedTask, status: targetStatus }
      onTaskUpdate(updatedTask)
    }
    setDraggedTask(null)
  }

  const getTasksForColumn = (columnId: string) => {
    return tasks.filter((task) => task.status === columnId)
  }

  const getTaskProgress = (task: Task) => {
    if (!task.actualHours || !task.estimatedHours) return 0
    return Math.min((task.actualHours / task.estimatedHours) * 100, 100)
  }

  const formatStatus = (status: TaskStatus) => {
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const isOverdue = (dueDate: Date) => {
    return new Date(dueDate) < new Date()
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
      {columns.map((column) => {
        const columnTasks = getTasksForColumn(column.id)
        
        return (
          <div key={column.id} className="space-y-4">
            <Card className={`${column.color} border-2`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold font-[family-name:var(--font-montserrat)]">
                    {column.title}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {columnTasks.length}
                    </Badge>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <div 
              className="space-y-3 min-h-[200px]"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id as TaskStatus)}
            >
              {columnTasks.map((task) => {
                const progress = getTaskProgress(task)
                const overdue = isOverdue(task.dueDate)
                const dueSoon = isDueSoon(task.dueDate)
                
                return (
                  <Card
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task)}
                    className="hover:shadow-md transition-all cursor-pointer hover:scale-[1.02] group"
                    onClick={() => onTaskSelect(task)}
                  >
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <h4 className="font-medium text-sm font-[family-name:var(--font-montserrat)] leading-tight">
                            {task.title}
                          </h4>
                          <div className="flex items-center gap-1">
                            {starredTasks.has(task.id) && <Star className="w-4 h-4 text-accent fill-current flex-shrink-0" />}
                            {task.status === "completed" && <Award className="w-4 h-4 text-accent flex-shrink-0" />}
                            {overdue && <Clock className="w-4 h-4 text-red-500 flex-shrink-0" />}
                          </div>
                        </div>

                        {task.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 font-[family-name:var(--font-open-sans)]">
                            {task.description}
                          </p>
                        )}

                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`text-xs ${priorityColors[task.priority as keyof typeof priorityColors]}`}
                          >
                            <Flag className="w-2 h-2 mr-1" />
                            {task.priority}
                          </Badge>

                          {task.status === "completed" && <Award className="w-4 h-4 text-accent" />}
                        </div>

                        {progress > 0 && task.status !== "completed" && (
                          <div>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-muted-foreground">Progress</span>
                              <span className="font-medium">{Math.round(progress)}%</span>
                            </div>
                            <Progress value={progress} className="h-1.5" />
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-xs">
                            <Clock className="w-3 h-3" />
                            <span className={`${
                              overdue ? 'text-red-600' : dueSoon ? 'text-orange-600' : 'text-muted-foreground'
                            }`}>
                              {overdue ? 'Overdue' : dueSoon ? 'Due soon' : format(task.dueDate, 'MMM d')}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleStarToggle(task.id)
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                            >
                              <Star className={`w-3 h-3 ${starredTasks.has(task.id) ? 'text-accent fill-current' : 'text-muted-foreground'}`} />
                            </Button>
                            
                            {task.comments && task.comments.length > 0 && (
                              <MessageSquare className="w-3 h-3 text-muted-foreground" />
                            )}
                            {task.attachments && task.attachments.length > 0 && (
                              <Paperclip className="w-3 h-3 text-muted-foreground" />
                            )}
                            <Avatar className="w-5 h-5">
                              <AvatarImage src={task.assignees?.[0]?.avatar || "/placeholder.svg"} />
                              <AvatarFallback className="text-xs">
                                {task.assignees?.[0]?.name
                                  ?.split(" ")
                                  .map((n) => n[0])
                                  .join("") || "U"}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                        </div>

                        {/* Time tracking info */}
                        {task.estimatedHours && (
                          <div className="text-xs text-muted-foreground">
                            {task.actualHours || 0}h / {task.estimatedHours}h
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
              
              {/* Empty state for column */}
              {columnTasks.length === 0 && (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  <div className="text-center">
                    <div className="text-4xl mb-2">📋</div>
                    <p className="text-sm">No tasks</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
