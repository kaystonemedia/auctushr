'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function TestScoringPage() {
  const [testResults, setTestResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [taskCount, setTaskCount] = useState(1)

  const runScoringTest = async (testType: string, params: any = {}) => {
    setLoading(true)
    try {
      const response = await fetch('/api/test/scoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testType, ...params })
      })
      const result = await response.json()
      setTestResults(result)
    } catch (error) {
      console.error('Test failed:', error)
      setTestResults({ error: 'Test failed' })
    } finally {
      setLoading(false)
    }
  }

  const createTestTasks = async (taskType: string) => {
    setLoading(true)
    try {
      const response = await fetch('/api/test/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskType, count: taskCount })
      })
      const result = await response.json()
      setTestResults(result)
    } catch (error) {
      console.error('Task creation failed:', error)
      setTestResults({ error: 'Task creation failed' })
    } finally {
      setLoading(false)
    }
  }

  const completeTestTask = async (taskId: string, actualHours?: number) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/tasks/${taskId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actualHours, productivityImpact: 'positive' })
      })
      const result = await response.json()
      setTestResults(result)
    } catch (error) {
      console.error('Task completion failed:', error)
      setTestResults({ error: 'Task completion failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Phase 2: Scoring Engine Test</h1>
        <p className="text-muted-foreground">
          Test the event-driven productivity scoring system
        </p>
      </div>

      <Tabs defaultValue="scoring" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="scoring">Scoring Tests</TabsTrigger>
          <TabsTrigger value="tasks">Task Creation</TabsTrigger>
          <TabsTrigger value="completion">Task Completion</TabsTrigger>
        </TabsList>

        <TabsContent value="scoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scoring Engine Tests</CardTitle>
              <CardDescription>
                Test different aspects of the productivity scoring system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button 
                  onClick={() => runScoringTest('single_event', { eventType: 'completed' })}
                  disabled={loading}
                  className="h-20"
                >
                  <div className="text-center">
                    <div className="font-semibold">Single Event</div>
                    <div className="text-sm opacity-80">Test task completion</div>
                  </div>
                </Button>

                <Button 
                  onClick={() => runScoringTest('multiple_events')}
                  disabled={loading}
                  className="h-20"
                >
                  <div className="text-center">
                    <div className="font-semibold">Multiple Events</div>
                    <div className="text-sm opacity-80">Test event sequence</div>
                  </div>
                </Button>

                <Button 
                  onClick={() => runScoringTest('priority_test')}
                  disabled={loading}
                  className="h-20"
                >
                  <div className="text-center">
                    <div className="font-semibold">Priority Test</div>
                    <div className="text-sm opacity-80">Test priority weights</div>
                  </div>
                </Button>

                <Button 
                  onClick={() => runScoringTest('difficulty_test')}
                  disabled={loading}
                  className="h-20"
                >
                  <div className="text-center">
                    <div className="font-semibold">Difficulty Test</div>
                    <div className="text-sm opacity-80">Test difficulty multipliers</div>
                  </div>
                </Button>

                <Button 
                  onClick={() => runScoringTest('timing_test')}
                  disabled={loading}
                  className="h-20"
                >
                  <div className="text-center">
                    <div className="font-semibold">Timing Test</div>
                    <div className="text-sm opacity-80">Test timing bonuses/penalties</div>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create Test Tasks</CardTitle>
              <CardDescription>
                Create test tasks to verify scoring in real scenarios
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Label htmlFor="taskCount">Number of tasks:</Label>
                <Input
                  id="taskCount"
                  type="number"
                  value={taskCount}
                  onChange={(e) => setTaskCount(parseInt(e.target.value) || 1)}
                  className="w-20"
                  min="1"
                  max="10"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button 
                  onClick={() => createTestTasks('basic')}
                  disabled={loading}
                  className="h-20"
                >
                  <div className="text-center">
                    <div className="font-semibold">Basic Tasks</div>
                    <div className="text-sm opacity-80">Medium priority</div>
                  </div>
                </Button>

                <Button 
                  onClick={() => createTestTasks('high_priority')}
                  disabled={loading}
                  className="h-20"
                >
                  <div className="text-center">
                    <div className="font-semibold">High Priority</div>
                    <div className="text-sm opacity-80">Urgent tasks</div>
                  </div>
                </Button>

                <Button 
                  onClick={() => createTestTasks('low_priority')}
                  disabled={loading}
                  className="h-20"
                >
                  <div className="text-center">
                    <div className="font-semibold">Low Priority</div>
                    <div className="text-sm opacity-80">Easy tasks</div>
                  </div>
                </Button>

                <Button 
                  onClick={() => createTestTasks('overdue')}
                  disabled={loading}
                  className="h-20"
                >
                  <div className="text-center">
                    <div className="font-semibold">Overdue Tasks</div>
                    <div className="text-sm opacity-80">Test penalties</div>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completion" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Complete Test Tasks</CardTitle>
              <CardDescription>
                Complete tasks to test real scoring integration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="taskId">Task ID:</Label>
                <Input
                  id="taskId"
                  placeholder="Enter task ID to complete"
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="actualHours">Actual Hours (optional):</Label>
                <Input
                  id="actualHours"
                  type="number"
                  placeholder="Enter actual hours worked"
                  className="w-full"
                />
              </div>
              <Button 
                onClick={() => {
                  const taskId = (document.getElementById('taskId') as HTMLInputElement)?.value
                  const actualHours = (document.getElementById('actualHours') as HTMLInputElement)?.value
                  if (taskId) {
                    completeTestTask(taskId, actualHours ? parseFloat(actualHours) : undefined)
                  }
                }}
                disabled={loading}
                className="w-full"
              >
                Complete Task & Test Scoring
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {testResults && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
            <CardDescription>
              {testResults.timestamp && `Test run at: ${new Date(testResults.timestamp).toLocaleString()}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm">
              {JSON.stringify(testResults, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="text-center">
          <div className="inline-flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            <span>Running test...</span>
          </div>
        </div>
      )}
    </div>
  )
}







