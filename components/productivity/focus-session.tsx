import { useState, useEffect, useCallback } from 'react'
import { useNewAuth } from '@/contexts/new-auth-context'
import { ProductivityService } from '@/lib/productivity'
import { FocusSession, ProductivitySettings } from '@/types/productivity'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Clock, Play, Pause, StopCircle, AlertCircle, CheckCircle } from 'lucide-react'

const DEFAULT_SETTINGS: ProductivitySettings = {
  focusSessionDuration: 25, // minutes
  breakDuration: 5, // minutes
  maxFocusSessionsPerDay: 8,
  minFocusTimePercentage: 60, // 60%
  maxMeetingTimePercentage: 30, // 30%
  productivityThresholds: {
    low: 40,
    medium: 70,
    high: 90
  },
  notificationPreferences: {
    focusReminders: true,
    breakReminders: true,
    productivityAlerts: true,
    meetingReminders: true
  }
}

export function FocusSessionComponent() {
  const { user } = useNewAuth()
  const [activeSession, setActiveSession] = useState<FocusSession | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0) // in seconds
  const [isPaused, setIsPaused] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string>('')
  const [interruptionReason, setInterruptionReason] = useState('')
  const [sessionNotes, setSessionNotes] = useState('')
  const [tasks, setTasks] = useState<Array<{ id: string; title: string }>>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      fetchTasks()
    }
  }, [user])

  useEffect(() => {
    let timer: NodeJS.Timeout

    if (activeSession && !isPaused) {
      timer = setInterval(() => {
        setElapsedTime(prev => prev + 1)
      }, 1000)
    }

    return () => {
      if (timer) {
        clearInterval(timer)
      }
    }
  }, [activeSession, isPaused])

  const fetchTasks = async () => {
    try {
      const service = ProductivityService.getInstance(DEFAULT_SETTINGS)
      const userTasks = await service.getTasks(user!.uid, new Date(), new Date())
      setTasks(userTasks.map(task => ({ id: task.id, title: task.title })))
    } catch (error) {
      console.error('Error fetching tasks:', error)
      toast.error('Failed to fetch tasks')
    }
  }

  const startSession = async () => {
    if (!user) return

    try {
      setLoading(true)
      const service = ProductivityService.getInstance(DEFAULT_SETTINGS)
      const session = await service.startFocusSession(selectedTaskId, user.uid)
      setActiveSession(session)
      setElapsedTime(0)
      setIsPaused(false)
      toast.success('Focus session started')
    } catch (error) {
      console.error('Error starting focus session:', error)
      toast.error('Failed to start focus session')
    } finally {
      setLoading(false)
    }
  }

  const pauseSession = () => {
    if (!activeSession) return

    setIsPaused(true)
    toast.info('Focus session paused')
  }

  const resumeSession = () => {
    if (!activeSession) return

    setIsPaused(false)
    toast.info('Focus session resumed')
  }

  const recordInterruption = async () => {
    if (!activeSession || !interruptionReason) return

    try {
      setLoading(true)
      const service = ProductivityService.getInstance(DEFAULT_SETTINGS)
      await service.recordInterruption(activeSession.id, {
        time: new Date(),
        duration: 0, // Will be calculated when session ends
        reason: interruptionReason
      })
      setInterruptionReason('')
      toast.info('Interruption recorded')
    } catch (error) {
      console.error('Error recording interruption:', error)
      toast.error('Failed to record interruption')
    } finally {
      setLoading(false)
    }
  }

  const endSession = async () => {
    if (!activeSession) return

    try {
      setLoading(true)
      const service = ProductivityService.getInstance(DEFAULT_SETTINGS)
      await service.endFocusSession(activeSession.id, sessionNotes)
      setActiveSession(null)
      setElapsedTime(0)
      setIsPaused(false)
      setSessionNotes('')
      toast.success('Focus session completed')
    } catch (error) {
      console.error('Error ending focus session:', error)
      toast.error('Failed to end focus session')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const getProgressColor = (progress: number) => {
    if (progress >= DEFAULT_SETTINGS.productivityThresholds.high) return 'bg-green-500'
    if (progress >= DEFAULT_SETTINGS.productivityThresholds.medium) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Focus Session</CardTitle>
          <CardDescription>
            Track your focus time and boost productivity
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!activeSession ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="task">Select Task</Label>
                <Select
                  value={selectedTaskId}
                  onValueChange={setSelectedTaskId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a task to focus on" />
                  </SelectTrigger>
                  <SelectContent>
                    {tasks.map(task => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                className="w-full"
                onClick={startSession}
                disabled={!selectedTaskId || loading}
              >
                <Play className="mr-2 h-4 w-4" />
                Start Focus Session
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Elapsed Time</p>
                  <div className="text-3xl font-bold">
                    {formatTime(elapsedTime)}
                  </div>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-sm font-medium">Target</p>
                  <div className="text-3xl font-bold">
                    {formatTime(DEFAULT_SETTINGS.focusSessionDuration * 60)}
                  </div>
                </div>
              </div>

              <Progress
                value={(elapsedTime / (DEFAULT_SETTINGS.focusSessionDuration * 60)) * 100}
                className={getProgressColor(
                  (elapsedTime / (DEFAULT_SETTINGS.focusSessionDuration * 60)) * 100
                )}
              />

              <div className="flex items-center justify-between space-x-4">
                {isPaused ? (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={resumeSession}
                    disabled={loading}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Resume
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={pauseSession}
                    disabled={loading}
                  >
                    <Pause className="mr-2 h-4 w-4" />
                    Pause
                  </Button>
                )}
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={endSession}
                  disabled={loading}
                >
                  <StopCircle className="mr-2 h-4 w-4" />
                  End Session
                </Button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="interruption">Record Interruption</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="interruption"
                      value={interruptionReason}
                      onChange={(e) => setInterruptionReason(e.target.value)}
                      placeholder="What interrupted you?"
                      disabled={loading}
                    />
                    <Button
                      variant="outline"
                      onClick={recordInterruption}
                      disabled={!interruptionReason || loading}
                    >
                      <AlertCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Session Notes</Label>
                  <Textarea
                    id="notes"
                    value={sessionNotes}
                    onChange={(e) => setSessionNotes(e.target.value)}
                    placeholder="Add any notes about this focus session..."
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <div className="text-sm text-muted-foreground">
            {activeSession ? (
              <div className="flex items-center">
                <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                Focus session in progress
              </div>
            ) : (
              <div className="flex items-center">
                <Clock className="mr-2 h-4 w-4" />
                Ready to focus
              </div>
            )}
          </div>
          {activeSession && (
            <div className="text-sm text-muted-foreground">
              {isPaused ? 'Session paused' : 'Session active'}
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  )
} 