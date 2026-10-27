'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useElectronFeatures } from '@/lib/electron-bridge'
import {
  DEFAULT_TOOLS_POLICY,
  TOOLS_CLIENT_SESSIONS_STORAGE_KEY,
  TOOLS_POLICY_STORAGE_KEY,
  TOOLS_WORK_SESSION_STORAGE_KEY,
} from '@/lib/tools/constants'
import { computeProductivityScore } from '@/lib/tools/format'
import type {
  ClientWorkSession,
  ClientSessionType,
  ToolsActivityStats,
  ToolsPolicy,
  ToolsTaskStats,
  ToolsWorkSession,
  WorkState,
} from '@/types/tools'

interface ToolsSessionContextValue {
  policy: ToolsPolicy
  workSession: ToolsWorkSession
  clientSessions: ClientWorkSession[]
  activeClientSession: ClientWorkSession | undefined
  workState: WorkState
  taskStats: ToolsTaskStats
  activity: ToolsActivityStats
  isElectronEnv: boolean
  startWork: () => void
  stopWork: () => void
  toggleBreak: () => void
  startClientSession: (input: {
    clientName: string
    sessionType: ClientSessionType
    recordingLink?: string
    tags: string[]
    notes?: string
    assignedAgent: string
  }) => boolean
  endClientSession: () => void
}

const defaultWorkSession: ToolsWorkSession = {
  isMonitoring: false,
  isOnBreak: false,
  sessionStart: null,
  breakStart: null,
  breakDurationMs: 0,
  idleDurationMs: 0,
  sessionDurationMs: 0,
  updatedAt: new Date().toISOString(),
}

const defaultActivity: ToolsActivityStats = {
  activeTimeMs: 0,
  idleTimeMs: 0,
  totalTimeMs: 0,
  screenshotsCount: 0,
  activitiesCount: 0,
  productivityScore: 0,
  clientWorkMinutes: 0,
}

const ToolsSessionContext = createContext<ToolsSessionContextValue | null>(null)

export function ToolsSessionProvider({ children }: { children: React.ReactNode }) {
  const { electronAPI, isElectron: isElectronEnv } = useElectronFeatures()
  const [policy, setPolicy] = useState<ToolsPolicy>(DEFAULT_TOOLS_POLICY)
  const [workSession, setWorkSession] = useState<ToolsWorkSession>(defaultWorkSession)
  const [clientSessions, setClientSessions] = useState<ClientWorkSession[]>([])
  const [taskStats, setTaskStats] = useState<ToolsTaskStats>({
    received: 0,
    pending: 0,
    completed: 0,
  })
  const [activity, setActivity] = useState<ToolsActivityStats>(defaultActivity)
  const breakStartRef = useRef<Date | null>(null)
  const sessionStartRef = useRef<Date | null>(null)
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const workSessionRef = useRef(workSession)
  const clientSessionsRef = useRef(clientSessions)
  const syncInFlightRef = useRef(false)
  // Desktop app session sync: true while this page mirrors a session the desktop app owns
  const followingDesktopRef = useRef(false)
  const lastSeenRemoteSessionRef = useRef<string | null>(null)
  const lastOwnSyncAtRef = useRef<string | null>(null)

  workSessionRef.current = workSession
  clientSessionsRef.current = clientSessions

  const activeClientSession = useMemo(
    () => clientSessions.find((session) => session.status === 'active'),
    [clientSessions]
  )

  const effectiveBreakMs = useMemo(() => {
    let total = workSession.breakDurationMs
    if (workSession.isOnBreak && breakStartRef.current) {
      total += Date.now() - breakStartRef.current.getTime()
    }
    return total
  }, [workSession.breakDurationMs, workSession.isOnBreak])

  const workState: WorkState = useMemo(() => {
    if (activeClientSession) return 'client_work'
    if (workSession.isOnBreak) return 'break'
    if (workSession.isMonitoring) {
      return workSession.idleDurationMs > 60_000 ? 'idle' : 'active'
    }
    return 'inactive'
  }, [activeClientSession, workSession])

  const persistLocal = useCallback(
    (session: ToolsWorkSession, sessions: ClientWorkSession[]) => {
      if (typeof window === 'undefined') return
      window.localStorage.setItem(TOOLS_WORK_SESSION_STORAGE_KEY, JSON.stringify(session))
      window.localStorage.setItem(TOOLS_CLIENT_SESSIONS_STORAGE_KEY, JSON.stringify(sessions))
    },
    []
  )

  const applyPolicyFromStorage = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(TOOLS_POLICY_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<ToolsPolicy>
      setPolicy((prev) => ({
        ...prev,
        totalWorkHours: parsed.totalWorkHours ?? prev.totalWorkHours,
        allowedBreakMinutes: parsed.allowedBreakMinutes ?? prev.allowedBreakMinutes,
        screenshotIntervalMinutes:
          parsed.screenshotIntervalMinutes ?? prev.screenshotIntervalMinutes,
      }))
    } catch (error) {
      console.error('Failed to parse local tools policy:', error)
    }
  }, [])

  const loadRemote = useCallback(async () => {
    try {
      const [policyRes, sessionRes, clientRes, summaryRes] = await Promise.all([
        fetch('/api/tools/policy'),
        fetch('/api/tools/session'),
        fetch('/api/tools/client-sessions'),
        fetch('/api/tools/summary'),
      ])

      if (policyRes.ok) {
        const data = await policyRes.json()
        if (data.policy) {
          setPolicy(data.policy)
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(
              TOOLS_POLICY_STORAGE_KEY,
              JSON.stringify({ ...data.policy, updatedAt: new Date().toISOString() })
            )
          }
        }
      }

      if (sessionRes.ok) {
        const data = await sessionRes.json()
        if (data.session) {
          setWorkSession(data.session)
          sessionStartRef.current = data.session.sessionStart
            ? new Date(data.session.sessionStart)
            : null
          breakStartRef.current = data.session.breakStart
            ? new Date(data.session.breakStart)
            : null
        }
      }

      if (clientRes.ok) {
        const data = await clientRes.json()
        if (Array.isArray(data.sessions)) {
          setClientSessions(data.sessions)
        }
      }

      if (summaryRes.ok) {
        const data = await summaryRes.json()
        if (data.taskStats) setTaskStats(data.taskStats)
        if (data.activity) setActivity(data.activity)
      }
    } catch (error) {
      console.error('Failed to load tools remote state:', error)
    }
  }, [])

  const syncToServer = useCallback(async () => {
    // While showing a session owned by the desktop app, let the desktop app write it
    if (followingDesktopRef.current) return
    if (syncInFlightRef.current) return
    syncInFlightRef.current = true
    try {
      const session = workSessionRef.current
      const sessions = clientSessionsRef.current
      const sessionPayload: ToolsWorkSession = {
        ...session,
        updatedAt: new Date().toISOString(),
        source: 'web',
      }

      const [sessionRes, clientRes] = await Promise.all([
        fetch('/api/tools/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session: sessionPayload }),
        }),
        fetch('/api/tools/client-sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessions }),
        }),
      ])

      if (!sessionRes.ok || !clientRes.ok) {
        throw new Error('Background sync failed')
      }

      const sessionData = await sessionRes.json().catch(() => null)
      if (sessionData?.syncedAt) lastOwnSyncAtRef.current = sessionData.syncedAt

      persistLocal(sessionPayload, sessions)
    } catch (error) {
      console.error('Tools background sync failed:', error)
    } finally {
      syncInFlightRef.current = false
    }
  }, [persistLocal])

  const refreshSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/tools/summary')
      if (!res.ok) return
      const data = await res.json()
      if (data.taskStats) setTaskStats(data.taskStats)
      if (data.activity) setActivity(data.activity)
    } catch (error) {
      console.error('Failed to refresh tools summary:', error)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const sessionRaw = window.localStorage.getItem(TOOLS_WORK_SESSION_STORAGE_KEY)
      const clientRaw = window.localStorage.getItem(TOOLS_CLIENT_SESSIONS_STORAGE_KEY)
      if (sessionRaw) setWorkSession(JSON.parse(sessionRaw) as ToolsWorkSession)
      if (clientRaw) setClientSessions(JSON.parse(clientRaw) as ClientWorkSession[])
    } catch (error) {
      console.error('Failed to load local tools state:', error)
    }
    applyPolicyFromStorage()
    loadRemote()

    const onPolicyUpdate = () => applyPolicyFromStorage()
    const onSummaryRefresh = () => {
      void loadRemote()
    }
    window.addEventListener('productivity-settings-updated', onPolicyUpdate)
    window.addEventListener('tools-summary-refresh', onSummaryRefresh)
    return () => {
      window.removeEventListener('productivity-settings-updated', onPolicyUpdate)
      window.removeEventListener('tools-summary-refresh', onSummaryRefresh)
    }
  }, [applyPolicyFromStorage, loadRemote])

  useEffect(() => {
    if (!isElectronEnv || !electronAPI) return

    const loadElectron = async () => {
      try {
        const status = await electronAPI.getMonitoringStatus?.()
        if (!status) return
        setWorkSession((prev) => ({
          ...prev,
          isMonitoring: Boolean(status.isMonitoring),
          sessionStart: status.sessionStart || prev.sessionStart,
          sessionDurationMs: status.sessionDuration || prev.sessionDurationMs,
          idleDurationMs: status.idleTime || prev.idleDurationMs,
        }))
        if (status.sessionStart) sessionStartRef.current = new Date(status.sessionStart)
      } catch (error) {
        console.error('Electron status load failed:', error)
      }
    }

    const onStats = (data: {
      sessionDuration?: number
      idleTime?: number
      activeTime?: number
      productivityScore?: number
      screenshotCount?: number
    }) => {
      const sessionDuration = data.sessionDuration || 0
      const idleMs = data.idleTime || 0
      const activeMs = data.activeTime || Math.max(0, sessionDuration - idleMs)
      setWorkSession((prev) => ({
        ...prev,
        sessionDurationMs: sessionDuration,
        idleDurationMs: idleMs,
      }))
      setActivity((prev) => ({
        ...prev,
        activeTimeMs: activeMs,
        idleTimeMs: idleMs,
        totalTimeMs: sessionDuration,
        productivityScore: data.productivityScore || computeProductivityScore(activeMs, sessionDuration),
        screenshotsCount: data.screenshotCount ?? prev.screenshotsCount,
      }))
    }

    loadElectron()
    electronAPI.onMonitoringStatusChanged?.((data: { isMonitoring?: boolean; startTime?: string }) => {
      setWorkSession((prev) => ({
        ...prev,
        isMonitoring: Boolean(data.isMonitoring),
        sessionStart: data.startTime || prev.sessionStart,
      }))
      if (data.startTime) sessionStartRef.current = new Date(data.startTime)
    })
    electronAPI.onStatsUpdated?.(onStats)
    electronAPI.onTaskStatsUpdated?.((data: ToolsTaskStats) => {
      if (data) setTaskStats(data)
    })
  }, [isElectronEnv, electronAPI])

  // In a normal browser, mirror the session the desktop monitoring app saves to
  // /api/tools/session (source: 'desktop'), so both apps show the same session.
  useEffect(() => {
    if (isElectronEnv) return
    let cancelled = false

    const pollDesktopSession = async () => {
      try {
        const res = await fetch('/api/tools/session')
        if (!res.ok || cancelled) return
        const data = await res.json()
        const remote = data.session as ToolsWorkSession | null
        if (!remote?.updatedAt || remote.source !== 'desktop') return

        // The desktop app saves every 20s; older than 90s means it closed or stopped
        // syncing without saying so
        const serverNow = data.serverTime ? new Date(data.serverTime).getTime() : Date.now()
        const isFresh = serverNow - new Date(remote.updatedAt).getTime() <= 90_000

        const isNew =
          remote.updatedAt !== lastSeenRemoteSessionRef.current &&
          !(lastOwnSyncAtRef.current && remote.updatedAt <= lastOwnSyncAtRef.current)
        // Keep checking a mirrored session even without new saves, so it ends once stale
        if (!isNew && !(followingDesktopRef.current && !isFresh)) return
        lastSeenRemoteSessionRef.current = remote.updatedAt

        if (remote.isMonitoring && isFresh) {
          followingDesktopRef.current = true
          sessionStartRef.current = remote.sessionStart ? new Date(remote.sessionStart) : null
          breakStartRef.current = remote.breakStart ? new Date(remote.breakStart) : null
          setWorkSession(remote)
          void refreshSummary()
        } else if (followingDesktopRef.current || workSessionRef.current.isMonitoring) {
          followingDesktopRef.current = false
          sessionStartRef.current = null
          breakStartRef.current = null
          setWorkSession({ ...remote, isMonitoring: false, isOnBreak: false, breakStart: null })
          void refreshSummary()
        }
      } catch (error) {
        console.error('Desktop session poll failed:', error)
      }
    }

    void pollDesktopSession()
    const interval = setInterval(pollDesktopSession, 10_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [isElectronEnv, refreshSummary])

  useEffect(() => {
    const tick = setInterval(() => {
      setWorkSession((prev) => {
        if (!prev.isMonitoring || !sessionStartRef.current) return prev
        const sessionDurationMs = Date.now() - sessionStartRef.current.getTime()
        let next = { ...prev, sessionDurationMs }
        if (prev.isOnBreak) {
          next = { ...next, idleDurationMs: prev.idleDurationMs + 1000 }
        }
        return next
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [])

  const sessionSyncKey = useMemo(
    () =>
      JSON.stringify({
        isMonitoring: workSession.isMonitoring,
        isOnBreak: workSession.isOnBreak,
        breakStart: workSession.breakStart,
        sessionStart: workSession.sessionStart,
        breakDurationMs: workSession.breakDurationMs,
        clients: clientSessions.map((s) => `${s.id}:${s.status}:${s.endTime ?? ''}`),
      }),
    [
      workSession.isMonitoring,
      workSession.isOnBreak,
      workSession.breakStart,
      workSession.sessionStart,
      workSession.breakDurationMs,
      clientSessions,
    ]
  )

  useEffect(() => {
    if (!workSession.isMonitoring) {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current)
      return
    }

    const debounced = setTimeout(() => {
      void syncToServer()
    }, 2000)

    syncTimerRef.current = setInterval(() => {
      void syncToServer()
      void refreshSummary()
    }, 20_000)

    return () => {
      clearTimeout(debounced)
      if (syncTimerRef.current) clearInterval(syncTimerRef.current)
    }
  }, [workSession.isMonitoring, sessionSyncKey, syncToServer, refreshSummary])

  useEffect(() => {
    const flush = () => {
      if (workSessionRef.current.isMonitoring) {
        void syncToServer()
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('beforeunload', flush)
    return () => {
      window.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('beforeunload', flush)
    }
  }, [syncToServer])

  const startWork = useCallback(() => {
    followingDesktopRef.current = false
    if (isElectronEnv && electronAPI) {
      try {
        electronAPI.startMonitoring?.()
      } catch (error) {
        console.error('Electron start failed:', error)
      }
    }
    const now = new Date().toISOString()
    sessionStartRef.current = new Date(now)
    breakStartRef.current = null
    setWorkSession({
      isMonitoring: true,
      isOnBreak: false,
      sessionStart: now,
      breakStart: null,
      breakDurationMs: 0,
      idleDurationMs: 0,
      sessionDurationMs: 0,
      updatedAt: now,
    })
    window.setTimeout(() => void syncToServer(), 500)
  }, [isElectronEnv, electronAPI, syncToServer])

  const stopWork = useCallback(() => {
    followingDesktopRef.current = false
    if (isElectronEnv && electronAPI) {
      try {
        electronAPI.pauseMonitoring?.()
      } catch (error) {
        console.error('Electron stop failed:', error)
      }
    }
    const flushSession = (prev: ToolsWorkSession): ToolsWorkSession => {
      const added =
        prev.isOnBreak && breakStartRef.current
          ? Date.now() - breakStartRef.current.getTime()
          : 0
      return {
        ...prev,
        breakDurationMs: prev.breakDurationMs + added,
        isMonitoring: false,
        isOnBreak: false,
        breakStart: null,
        updatedAt: new Date().toISOString(),
      }
    }
    setWorkSession((prev) => {
      const next = flushSession(prev)
      workSessionRef.current = next
      return next
    })
    breakStartRef.current = null
    sessionStartRef.current = null
    void syncToServer()
    void refreshSummary()
  }, [isElectronEnv, electronAPI, workSession.isOnBreak, syncToServer, refreshSummary])

  const toggleBreak = useCallback(() => {
    if (!workSession.isMonitoring) return
    followingDesktopRef.current = false
    if (workSession.isOnBreak) {
      const added = breakStartRef.current ? Date.now() - breakStartRef.current.getTime() : 0
      breakStartRef.current = null
      setWorkSession((prev) => ({
        ...prev,
        isOnBreak: false,
        breakStart: null,
        breakDurationMs: prev.breakDurationMs + added,
        updatedAt: new Date().toISOString(),
      }))
      void syncToServer()
      return
    }
    const now = new Date()
    breakStartRef.current = now
    setWorkSession((prev) => ({
      ...prev,
      isOnBreak: true,
      breakStart: now.toISOString(),
      updatedAt: now.toISOString(),
    }))
  }, [workSession.isMonitoring, workSession.isOnBreak, syncToServer])

  const startClientSession = useCallback(
    (input: {
      clientName: string
      sessionType: ClientSessionType
      recordingLink?: string
      tags: string[]
      notes?: string
      assignedAgent: string
    }) => {
      if (activeClientSession) return false
      const session: ClientWorkSession = {
        id: crypto.randomUUID(),
        clientName: input.clientName.trim(),
        sessionType: input.sessionType,
        recordingLink: input.recordingLink,
        tags: input.tags,
        assignedAgent: input.assignedAgent,
        notes: input.notes,
        startTime: new Date().toISOString(),
        status: 'active',
      }
      const next = [session, ...clientSessions]
      setClientSessions(next)
      persistLocal(workSession, next)
      void syncToServer()
      return true
    },
    [activeClientSession, clientSessions, persistLocal, workSession, syncToServer]
  )

  const endClientSession = useCallback(() => {
    if (!activeClientSession) return
    const now = new Date()
    const durationMinutes = Math.max(
      1,
      Math.round((now.getTime() - new Date(activeClientSession.startTime).getTime()) / 60000)
    )
    const next = clientSessions.map((session) =>
      session.id === activeClientSession.id
        ? {
            ...session,
            status: 'completed' as const,
            endTime: now.toISOString(),
            durationMinutes,
          }
        : session
    )
    setClientSessions(next)
    persistLocal(workSession, next)
    void syncToServer()
    void refreshSummary()
  }, [activeClientSession, clientSessions, persistLocal, workSession, syncToServer, refreshSummary])

  useEffect(() => {
    persistLocal(workSession, clientSessions)
  }, [workSession, clientSessions, persistLocal])

  const value: ToolsSessionContextValue = {
    policy,
    workSession,
    clientSessions,
    activeClientSession,
    workState,
    taskStats,
    activity,
    isElectronEnv,
    startWork,
    stopWork,
    toggleBreak,
    startClientSession,
    endClientSession,
  }

  return <ToolsSessionContext.Provider value={value}>{children}</ToolsSessionContext.Provider>
}

export function useToolsSession() {
  const context = useContext(ToolsSessionContext)
  if (!context) {
    throw new Error('useToolsSession must be used within ToolsSessionProvider')
  }
  return context
}

export function useToolsSessionOptional() {
  return useContext(ToolsSessionContext)
}
