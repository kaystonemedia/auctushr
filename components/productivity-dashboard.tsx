'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ActivityChart } from "@/components/activity-chart"
import { WebsiteStats } from "@/components/website-stats"
import { FocusTime } from "@/components/focus-time"
import { MeetingStats } from "@/components/meeting-stats"
import { TaskProgress } from "@/components/task-progress"
import { Calendar, Clock, BarChart, Target, Users, CheckCircle } from 'lucide-react'

interface ProductivityStats {
  focusTime: number
  idleTime: number
  breakTime: number
  meetingTime: number
  taskProgress: number
  topWebsites: Array<{
    domain: string
    time: number
    visits: number
  }>
  activityByHour: Array<{
    hour: number
    active: number
    idle: number
  }>
  meetings: Array<{
    title: string
    startTime: string
    endTime: string
    duration: number
  }>
  tasks: Array<{
    title: string
    completed: boolean
    timeSpent: number
  }>
}

export function ProductivityDashboard() {
  const [stats, setStats] = useState<ProductivityStats | null>(null)
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProductivityStats()
  }, [timeRange])

  const fetchProductivityStats = async () => {
    try {
      setLoading(true)
      // Get data from extension
      const response = await chrome.runtime.sendMessage({
        type: 'GET_PRODUCTIVITY_STATS',
        data: { timeRange }
      })

      if (response?.error) {
        throw new Error(response.error)
      }

      setStats(response.stats)
    } catch (error) {
      console.error('Error fetching productivity stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-8 text-gray-500">
        No productivity data available
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex justify-end">
        <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as any)}>
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="week">This Week</TabsTrigger>
            <TabsTrigger value="month">This Month</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Focus Time</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(stats.focusTime / 60)}h {Math.round(stats.focusTime % 60)}m
            </div>
            <p className="text-xs text-muted-foreground">
              {(stats.focusTime + stats.idleTime) > 0 ? Math.round((stats.focusTime / (stats.focusTime + stats.idleTime)) * 100) : 0}% of total time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Break Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(stats.breakTime / 60)}h {Math.round(stats.breakTime % 60)}m
            </div>
            <p className="text-xs text-muted-foreground">
              {(stats.focusTime + stats.idleTime) > 0 ? Math.round((stats.breakTime / (stats.focusTime + stats.idleTime)) * 100) : 0}% of total time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Meeting Time</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(stats.meetingTime / 60)}h {Math.round(stats.meetingTime % 60)}m
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.meetings.length} meetings today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Task Progress</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(stats.taskProgress)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.tasks.filter(t => t.completed).length} of {stats.tasks.length} tasks completed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Activity by Hour</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityChart data={stats.activityByHour} />
          </CardContent>
        </Card>

        {/* Website Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Top Websites</CardTitle>
          </CardHeader>
          <CardContent>
            <WebsiteStats websites={stats.topWebsites} />
          </CardContent>
        </Card>

        {/* Meeting Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Meetings</CardTitle>
          </CardHeader>
          <CardContent>
            <MeetingStats meetings={stats.meetings} />
          </CardContent>
        </Card>

        {/* Task Progress */}
        <Card>
          <CardHeader>
            <CardTitle>Task Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <TaskProgress tasks={stats.tasks} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 