"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Flag,
  Clock,
  User,
  MessageSquare,
  Play,
  Pause,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Target,
  Award,
  Star,
  Send,
  Paperclip,
  Plus,
} from "lucide-react"
import { Task, TaskStatus } from "@/types/task"
import { format } from "date-fns"

interface EnhancedTaskDrawerProps {
  task: Task | null
  open: boolean
  onClose: () => void
  onTaskUpdate?: (task: Task) => void
}

export function EnhancedTaskDrawer({ task, open, onClose, onTaskUpdate }: EnhancedTaskDrawerProps) {
  const [comment, setComment] = useState("")
  const [isAddingComment, setIsAddingComment] = useState(false)

  if (!task) return null

  const priorityColors = {
    low: "bg-blue-100 text-blue-800",
    medium: "bg-yellow-100 text-yellow-800",
    high: "bg-orange-100 text-orange-800",
    urgent: "bg-red-100 text-red-800",
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

  const formatStatus = (status: TaskStatus) => {
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const getTaskProgress = (task: Task) => {
    if (!task.actualHours || !task.estimatedHours) return 0
    return Math.min((task.actualHours / task.estimatedHours) * 100, 100)
  }

  const progress = getTaskProgress(task)

  // Mock data - replace with real data from props or API
  const mockComments = task.comments || [
    {
      id: 1,
      author: "Sarah Wilson",
      avatar: "/sarah-wilson-portrait.png",
      content: "I've reviewed the initial implementation. Looks good overall, but we need to add input validation.",
      timestamp: "2 hours ago",
    },
    {
      id: 2,
      author: "Mike Chen",
      avatar: "/mike-chen.jpg",
      content: "Added the validation logic. Ready for testing.",
      timestamp: "1 hour ago",
    },
  ]

  const mockSubtasks = [
    { id: 1, title: "Set up JWT configuration", completed: true },
    { id: 2, title: "Create login endpoint", completed: true },
    { id: 3, title: "Implement password hashing", completed: true },
    { id: 4, title: "Add role-based permissions", completed: false },
    { id: 5, title: "Write unit tests", completed: false },
  ]

  const handleStatusChange = (newStatus: TaskStatus) => {
    if (onTaskUpdate) {
      onTaskUpdate({ ...task, status: newStatus })
    }
  }

  const handleAddComment = () => {
    if (!comment.trim()) return
    
    // Here you would add the comment to the task
    console.log("Adding comment:", comment)
    setComment("")
    setIsAddingComment(false)
  }

  const handleSubtaskToggle = (subtaskId: number) => {
    // Here you would update the subtask completion status
    console.log("Toggling subtask:", subtaskId)
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <SheetTitle className="text-lg font-bold font-[family-name:var(--font-montserrat)] leading-tight">
                {task.title}
              </SheetTitle>
              <SheetDescription className="mt-2 font-[family-name:var(--font-open-sans)]">
                {task.description}
              </SheetDescription>
            </div>
            {task.status === "in_progress" && <Star className="w-5 h-5 text-blue-500 fill-current flex-shrink-0 ml-2" />}
          </div>

          {/* Status and Priority */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={priorityColors[task.priority as keyof typeof priorityColors]}>
              <Flag className="w-3 h-3 mr-1" />
              {task.priority} priority
            </Badge>
            <Badge variant="secondary" className={statusColors[task.status as keyof typeof statusColors]}>
              {formatStatus(task.status)}
            </Badge>
            {task.status === "completed" && <Award className="w-4 h-4 text-accent" />}
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Progress */}
          {progress > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Progress</span>
                <span className="text-sm font-bold">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>
          )}

          {/* Task Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Assignee</span>
              </div>
              <div className="flex items-center gap-2">
                <Avatar className="w-6 h-6">
                  <AvatarImage src={task.assignees?.[0]?.avatar || "/placeholder.svg"} />
                  <AvatarFallback className="text-xs">
                    {task.assignees?.[0]?.name
                      ?.split(" ")
                      .map((n: string) => n[0])
                      .join("") || "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{task.assignees?.[0]?.name || "Unassigned"}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Due Date</span>
              </div>
              <div className="text-sm font-medium">{format(task.dueDate, 'MMM d, yyyy')}</div>
            </div>
          </div>

          {/* Time Tracking */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Estimated</span>
              </div>
              <div className="text-sm font-medium">{task.estimatedHours || 0}h</div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Target className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Actual</span>
              </div>
              <div className="text-sm font-medium">{task.actualHours || 0}h</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {task.status === "pending" && (
              <Button className="flex-1" onClick={() => handleStatusChange("accepted")}>
                <Play className="w-4 h-4 mr-2" />
                Accept Task
              </Button>
            )}
            {task.status === "accepted" && (
              <Button className="flex-1" onClick={() => handleStatusChange("in_progress")}>
                <Play className="w-4 h-4 mr-2" />
                Start Task
              </Button>
            )}
            {task.status === "in_progress" && (
              <>
                <Button variant="outline" className="flex-1 bg-transparent">
                  <Pause className="w-4 h-4 mr-2" />
                  Pause
                </Button>
                <Button className="flex-1" onClick={() => handleStatusChange("completed")}>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Mark Complete
                </Button>
              </>
            )}
            {task.status === "in_review" && (
              <Button className="flex-1" onClick={() => handleStatusChange("completed")}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Approve
              </Button>
            )}
            <Button variant="outline" onClick={() => handleStatusChange("blocked")}>
              <AlertTriangle className="w-4 h-4 mr-2" />
              Block
            </Button>
          </div>

          <Separator />

          {/* Subtasks */}
          <div>
            <h4 className="font-semibold mb-3 font-[family-name:var(--font-montserrat)]">
              Subtasks ({mockSubtasks.filter((st) => st.completed).length}/{mockSubtasks.length})
            </h4>
            <div className="space-y-2">
              {mockSubtasks.map((subtask) => (
                <div key={subtask.id} className="flex items-center gap-2">
                  <Checkbox 
                    checked={subtask.completed} 
                    onCheckedChange={() => handleSubtaskToggle(subtask.id)}
                  />
                  <span className={`text-sm ${subtask.completed ? "line-through text-muted-foreground" : ""}`}>
                    {subtask.title}
                  </span>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="mt-2">
              <Plus className="w-3 h-3 mr-2" />
              Add Subtask
            </Button>
          </div>

          <Separator />

          {/* Attachments */}
          {task.attachments && task.attachments.length > 0 && (
            <div>
              <h4 className="font-semibold mb-3 font-[family-name:var(--font-montserrat)] flex items-center gap-2">
                <Paperclip className="w-4 h-4" />
                Attachments ({task.attachments.length})
              </h4>
              <div className="space-y-2">
                {task.attachments.map((attachment, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                    <Paperclip className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{attachment}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Comments */}
          <div>
            <h4 className="font-semibold mb-3 font-[family-name:var(--font-montserrat)] flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Comments ({mockComments.length})
            </h4>

            <div className="space-y-4">
              {mockComments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={comment.avatar || "/placeholder.svg"} />
                    <AvatarFallback className="text-xs">
                      {comment.author
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{comment.author}</span>
                      <span className="text-xs text-muted-foreground">{comment.timestamp}</span>
                    </div>
                    <p className="text-sm text-muted-foreground font-[family-name:var(--font-open-sans)]">
                      {comment.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Comment */}
            {isAddingComment ? (
              <div className="mt-4 space-y-2">
                <Textarea
                  placeholder="Add a comment..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="min-h-[80px]"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsAddingComment(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleAddComment}>
                    <Send className="w-3 h-3 mr-2" />
                    Comment
                  </Button>
                </div>
              </div>
            ) : (
              <Button 
                variant="ghost" 
                size="sm" 
                className="mt-4"
                onClick={() => setIsAddingComment(true)}
              >
                <MessageSquare className="w-3 h-3 mr-2" />
                Add Comment
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}







