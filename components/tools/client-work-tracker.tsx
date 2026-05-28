'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useNewAuth } from '@/contexts/new-auth-context'
import { useToolsSession } from '@/contexts/tools-session-context'
import { Briefcase, Clock, Link2, Play, Square } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'
import type { ClientSessionType } from '@/types/tools'
import { formatMinutesLabel } from '@/lib/tools/format'

export function ClientWorkTracker() {
  const { user } = useNewAuth()
  const {
    clientSessions,
    activeClientSession,
    startClientSession,
    endClientSession,
  } = useToolsSession()

  const [clientName, setClientName] = useState('')
  const [sessionType, setSessionType] = useState<ClientSessionType>('support_call')
  const [recordingLink, setRecordingLink] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [notes, setNotes] = useState('')

  const handleStart = () => {
    if (!clientName.trim()) {
      toast({
        title: 'Client name is required',
        variant: 'destructive',
      })
      return
    }
    if (activeClientSession) {
      toast({
        title: 'Session already active',
        description: 'End the current client session before starting another.',
        variant: 'destructive',
      })
      return
    }
    const ok = startClientSession({
      clientName: clientName.trim(),
      sessionType,
      recordingLink: recordingLink.trim() || undefined,
      tags: tagsInput
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      notes: notes.trim() || undefined,
      assignedAgent: user?.email || user?.name || 'Unassigned',
    })
    if (!ok) return
    setClientName('')
    setRecordingLink('')
    setTagsInput('')
    setNotes('')
    toast({ title: 'Client session started' })
  }

  const handleEnd = () => {
    endClientSession()
    toast({ title: 'Client session completed' })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          Client Work Tracker
        </CardTitle>
        <CardDescription>Log support calls and meetings with client context.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeClientSession ? (
          <div className="rounded-lg border bg-muted/40 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{activeClientSession.clientName}</div>
                <div className="text-xs text-muted-foreground">
                  Started {new Date(activeClientSession.startTime).toLocaleTimeString()}
                </div>
              </div>
              <Badge>Client work active</Badge>
            </div>
            <Button className="mt-3 w-full" variant="destructive" onClick={handleEnd}>
              <Square className="mr-2 h-4 w-4" />
              End client session
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="client-name">Client name / identifier</Label>
              <Input
                id="client-name"
                placeholder="Acme Corp / Ticket #123"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="session-type">Session type</Label>
              <Select value={sessionType} onValueChange={(v) => setSessionType(v as ClientSessionType)}>
                <SelectTrigger id="session-type" className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="support_call">Support call</SelectItem>
                  <SelectItem value="zoom_meeting">Zoom meeting</SelectItem>
                  <SelectItem value="onboarding">Onboarding</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="recording-link">Recording link (optional)</Label>
              <Input
                id="recording-link"
                placeholder="https://fathom.video/..."
                value={recordingLink}
                onChange={(e) => setRecordingLink(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="session-tags">Tags (comma separated)</Label>
              <Input
                id="session-tags"
                placeholder="billing, escalation"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="session-notes">Notes (optional)</Label>
              <Textarea
                id="session-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <Button onClick={handleStart}>
              <Play className="mr-2 h-4 w-4" />
              Start client session
            </Button>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Clock className="h-4 w-4" />
            Recent sessions
          </div>
          {clientSessions.length === 0 ? (
            <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              No sessions logged yet.
            </div>
          ) : (
            clientSessions.slice(0, 5).map((session) => (
              <div key={session.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">{session.clientName}</div>
                  <Badge variant={session.status === 'active' ? 'default' : 'secondary'}>
                    {session.status === 'active'
                      ? 'Active'
                      : formatMinutesLabel(session.durationMinutes || 0)}
                  </Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {session.sessionType.replace('_', ' ')} • {session.assignedAgent}
                </div>
                {session.recordingLink ? (
                  <a
                    href={session.recordingLink}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Link2 className="h-3 w-3" />
                    Recording
                  </a>
                ) : null}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
