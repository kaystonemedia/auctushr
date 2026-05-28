'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Save, Settings2 } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'

const STORAGE_KEY = 'tools.productivity.settings.v1'

interface ToolsPolicyState {
  totalWorkHours: number
  allowedBreakMinutes: number
  screenshotIntervalMinutes: number
}

const defaultState: ToolsPolicyState = {
  totalWorkHours: 8,
  allowedBreakMinutes: 60,
  screenshotIntervalMinutes: 5,
}

export function ToolsPolicySettings() {
  const [saving, setSaving] = useState(false)
  const [policy, setPolicy] = useState<ToolsPolicyState>(defaultState)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<ToolsPolicyState>
      setPolicy({
        totalWorkHours: parsed.totalWorkHours ?? defaultState.totalWorkHours,
        allowedBreakMinutes: parsed.allowedBreakMinutes ?? defaultState.allowedBreakMinutes,
        screenshotIntervalMinutes:
          parsed.screenshotIntervalMinutes ?? defaultState.screenshotIntervalMinutes,
      })
    } catch (error) {
      console.error('Failed to load tools policy settings:', error)
    }
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/tools/policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy),
      })
      if (!res.ok) {
        throw new Error('Failed to save policy')
      }
      const data = await res.json()
      const saved = data.policy || policy
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            ...saved,
            updatedAt: new Date().toISOString(),
          })
        )
        window.dispatchEvent(new Event('productivity-settings-updated'))
      }
      toast({
        title: 'Tools policy updated',
        description: 'Break rules and screenshot cadence are now synced for all agents.',
      })
    } catch (error) {
      console.error('Failed to save tools policy settings:', error)
      toast({
        title: 'Error',
        description: 'Failed to save tools policy settings.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          Tool Monitoring Policy
        </CardTitle>
        <CardDescription>Admin policy for work duration, break allowance, and screenshot automation.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="policy-work-hours">Total Work Duration (hours)</Label>
            <Input
              id="policy-work-hours"
              type="number"
              min="1"
              max="16"
              value={policy.totalWorkHours}
              onChange={(event) =>
                setPolicy((prev) => ({
                  ...prev,
                  totalWorkHours: Number(event.target.value) || defaultState.totalWorkHours,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="policy-break-minutes">Allowed Break (minutes)</Label>
            <Input
              id="policy-break-minutes"
              type="number"
              min="0"
              max="240"
              value={policy.allowedBreakMinutes}
              onChange={(event) =>
                setPolicy((prev) => ({
                  ...prev,
                  allowedBreakMinutes:
                    Number(event.target.value) || defaultState.allowedBreakMinutes,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Screenshot Interval</Label>
            <Select
              value={String(policy.screenshotIntervalMinutes)}
              onValueChange={(value) =>
                setPolicy((prev) => ({
                  ...prev,
                  screenshotIntervalMinutes: Number(value),
                }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select interval" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Every 1 minute</SelectItem>
                <SelectItem value="5">Every 5 minutes</SelectItem>
                <SelectItem value="10">Every 10 minutes</SelectItem>
                <SelectItem value="15">Every 15 minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Saving...' : 'Save Monitoring Policy'}
        </Button>
      </CardContent>
    </Card>
  )
}
