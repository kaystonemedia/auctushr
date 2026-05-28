"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ChevronLeft, ChevronRight, Award } from "lucide-react"
import { Task, TaskPriority } from "@/types/task"
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday } from "date-fns"

const priorityColors = {
  low: "bg-blue-500",
  medium: "bg-yellow-500",
  high: "bg-orange-500",
  urgent: "bg-red-500",
}

interface EnhancedCalendarViewProps {
  tasks: Task[]
  onTaskSelect: (task: Task) => void
  loading?: boolean
}

export function EnhancedCalendarView({ tasks, onTaskSelect, loading = false }: EnhancedCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const currentMonth = currentDate.getMonth()
  const currentYear = currentDate.getFullYear()

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ]

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  const getEventsForDate = (date: Date) => {
    return tasks.filter((task) => {
      const taskDate = new Date(task.dueDate)
      return isSameDay(taskDate, date)
    })
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1))
  }

  const renderCalendarDays = () => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const startDate = monthStart
    const endDate = monthEnd

    const days = eachDayOfInterval({ start: startDate, end: endDate })
    const firstDayOfMonth = monthStart.getDay()

    const calendarDays = []

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      calendarDays.push(
        <div key={`empty-${i}`} className="p-2 min-h-[100px]"></div>
      )
    }

    // Days of the month
    days.forEach((day) => {
      const events = getEventsForDate(day)
      const isCurrentDay = isToday(day)
      const isCurrentMonth = isSameMonth(day, currentDate)

      calendarDays.push(
        <div
          key={day.toISOString()}
          className={`p-2 min-h-[100px] border border-border ${
            isCurrentDay 
              ? "bg-primary/5 border-primary" 
              : isCurrentMonth 
                ? "hover:bg-muted/50" 
                : "bg-muted/20"
          }`}
        >
          <div className={`text-sm font-medium mb-2 ${
            isCurrentDay ? "text-primary" : isCurrentMonth ? "text-foreground" : "text-muted-foreground"
          }`}>
            {day.getDate()}
          </div>
          <div className="space-y-1">
            {events.slice(0, 3).map((task) => (
              <div
                key={task.id}
                className="text-xs p-1 rounded cursor-pointer hover:shadow-sm transition-shadow bg-card border"
                onClick={() => onTaskSelect(task)}
              >
                <div className="flex items-center gap-1 mb-1">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      priorityColors[task.priority as keyof typeof priorityColors]
                    }`}
                  />
                  <span className="font-medium truncate font-[family-name:var(--font-montserrat)]">
                    {task.title}
                  </span>
                  {task.status === "completed" && <Award className="w-3 h-3 text-accent flex-shrink-0" />}
                </div>
                <div className="flex items-center justify-between">
                  <Avatar className="w-4 h-4">
                    <AvatarImage src={task.assignees?.[0]?.avatar || "/placeholder.svg"} />
                    <AvatarFallback className="text-xs">
                      {task.assignees?.[0]?.name
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("") || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <Badge variant="outline" className="text-xs px-1 py-0">
                    {task.status.replace("_", " ")}
                  </Badge>
                </div>
              </div>
            ))}
            {events.length > 3 && (
              <div className="text-xs text-muted-foreground text-center">
                +{events.length - 3} more
              </div>
            )}
          </div>
        </div>
      )
    })

    return calendarDays
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-[family-name:var(--font-montserrat)]">
              {monthNames[currentMonth]} {currentYear}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigateMonth('prev')}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigateMonth('next')}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-7">
            {/* Day headers */}
            {dayNames.map((day) => (
              <div key={day} className="p-4 text-center font-medium text-sm bg-muted border-b border-border">
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {renderCalendarDays()}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">Priority:</span>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span>Low</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span>Medium</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <span>High</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span>Urgent</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
