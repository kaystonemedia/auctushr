"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Zap, Flame, Target, TrendingUp, Award, CheckCircle2, Clock } from "lucide-react"
import { Task } from "@/types/task"
import { isSameDay } from "date-fns"

interface EnhancedProductivityWidgetProps {
  tasks?: Task[]
  productivityScore?: number
  currentStreak?: number
  weeklyGoal?: number
}

export function EnhancedProductivityWidget({ 
  tasks = [], 
  productivityScore = 87, 
  currentStreak = 5, 
  weeklyGoal = 40 
}: EnhancedProductivityWidgetProps) {
  // Calculate metrics from tasks
  const todayTasks = tasks.filter(task => {
    const today = new Date()
    const taskDate = new Date(task.dueDate)
    return isSameDay(taskDate, today)
  }).length

  const completedToday = tasks.filter(task => {
    const today = new Date()
    const completedDate = task.completedAt
    return completedDate && isSameDay(new Date(completedDate), today)
  }).length

  const weeklyProgress = tasks.filter(task => {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return task.completedAt && new Date(task.completedAt) >= weekAgo
  }).length

  const overdueTasks = tasks.filter(task => {
    const today = new Date()
    const dueDate = new Date(task.dueDate)
    return dueDate < today && task.status !== 'completed'
  }).length

  const inProgressTasks = tasks.filter(task => task.status === 'in_progress').length

  const badges = [
    { id: 1, name: "Early Bird", icon: "🌅", earned: completedToday > 0 },
    { id: 2, name: "Streak Master", icon: "🔥", earned: currentStreak >= 3 },
    { id: 3, name: "High Performer", icon: "⭐", earned: productivityScore >= 80 },
    { id: 4, name: "Team Player", icon: "🤝", earned: completedToday >= 3 },
  ]

  const getProductivityMessage = () => {
    if (productivityScore >= 90) return "Outstanding work!"
    if (productivityScore >= 80) return "Great progress!"
    if (productivityScore >= 70) return "Good job!"
    if (productivityScore >= 60) return "Keep it up!"
    return "You can do better!"
  }

  const getStreakMessage = () => {
    if (currentStreak >= 7) return "Amazing streak!"
    if (currentStreak >= 5) return "Great consistency!"
    if (currentStreak >= 3) return "Good momentum!"
    return "Start a streak!"
  }

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20 h-fit">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold font-[family-name:var(--font-montserrat)] flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          Productivity Hub
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Daily Score */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium">Today's Score</span>
            <span className="text-lg font-bold text-primary">{productivityScore}</span>
          </div>
          <Progress value={productivityScore} className="h-1.5" />
          <p className="text-xs text-muted-foreground mt-1">{getProductivityMessage()}</p>
        </div>

        {/* Current Streak */}
        <div className="flex items-center justify-between p-2 bg-accent/10 rounded-lg">
          <div className="flex items-center gap-1">
            <Flame className="w-3 h-3 text-orange-500" />
            <span className="text-xs font-medium">Streak</span>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold">{currentStreak}</div>
            <div className="text-xs text-muted-foreground">days</div>
          </div>
        </div>

        {/* Today's Progress */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium">Completed</span>
            <span className="text-sm font-bold">{completedToday}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Target className="w-3 h-3" />
            <span>{completedToday > 0 ? "Great progress!" : "Start your day!"}</span>
          </div>
        </div>

        {/* Weekly Goal */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium">Weekly Goal</span>
            <span className="text-xs">
              {weeklyProgress}/{weeklyGoal}
            </span>
          </div>
          <Progress value={(weeklyProgress / weeklyGoal) * 100} className="h-1.5" />
          <div className="flex items-center gap-1 mt-1">
            <TrendingUp className="w-3 h-3 text-green-500" />
            <span className="text-xs text-green-600">
              {weeklyProgress >= weeklyGoal ? "Goal achieved!" : "On track"}
            </span>
          </div>
        </div>

        {/* Task Stats */}
        <div className="grid grid-cols-1 gap-1 text-xs">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-blue-500" />
            <span>{inProgressTasks} in progress</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-green-500" />
            <span>{completedToday} completed</span>
          </div>
        </div>

        {/* Overdue Warning */}
        {overdueTasks > 0 && (
          <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-1 text-red-700">
              <Target className="w-3 h-3" />
              <span className="text-xs font-medium">{overdueTasks} overdue</span>
            </div>
          </div>
        )}

        {/* Recent Badges */}
        <div>
          <div className="flex items-center gap-1 mb-2">
            <Award className="w-3 h-3 text-accent" />
            <span className="text-xs font-medium">Badges</span>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {badges.slice(0, 4).map((badge) => (
              <div
                key={badge.id}
                className={`p-1 rounded text-center transition-all ${
                  badge.earned 
                    ? "bg-accent/20 border border-accent/30" 
                    : "bg-muted/50 border border-muted opacity-50"
                }`}
              >
                <div className="text-sm mb-0.5">{badge.icon}</div>
                <div className="text-xs font-medium">{badge.name}</div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

