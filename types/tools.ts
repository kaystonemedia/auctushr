export type WorkState = 'inactive' | 'active' | 'idle' | 'break' | 'client_work'

export type ClientSessionType = 'support_call' | 'zoom_meeting' | 'onboarding' | 'other'

export interface ToolsPolicy {
  totalWorkHours: number
  allowedBreakMinutes: number
  screenshotIntervalMinutes: number
}

export interface ToolsWorkSession {
  isMonitoring: boolean
  isOnBreak: boolean
  sessionStart: string | null
  breakStart: string | null
  breakDurationMs: number
  idleDurationMs: number
  sessionDurationMs: number
  updatedAt: string
}

export interface ClientWorkSession {
  id: string
  clientName: string
  sessionType: ClientSessionType
  recordingLink?: string
  tags: string[]
  assignedAgent: string
  notes?: string
  startTime: string
  endTime?: string
  durationMinutes?: number
  status: 'active' | 'completed'
}

export interface ToolsTaskStats {
  received: number
  pending: number
  completed: number
}

export interface ToolsActivityStats {
  activeTimeMs: number
  idleTimeMs: number
  totalTimeMs: number
  screenshotsCount: number
  activitiesCount: number
  productivityScore: number
  clientWorkMinutes: number
}

export interface ToolsSyncStatus {
  lastSyncedAt: string | null
  syncing: boolean
  error: string | null
}
