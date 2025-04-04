import { AttendanceRecord, AttendanceSettings, AttendanceStats } from '@/types/attendance'

let idleTimer: NodeJS.Timeout | null = null
let lastActivityTime: Date | null = null
let idleStartTime: Date | null = null

export function startIdleTimeTracking(
  onIdleStart: (startTime: Date) => void,
  onIdleEnd: (startTime: Date, endTime: Date) => void,
  settings: AttendanceSettings
) {
  const { idleThreshold } = settings

  function resetIdleTimer() {
    if (idleTimer) {
      clearTimeout(idleTimer)
    }

    // If we were idle, record the end of idle period
    if (idleStartTime) {
      onIdleEnd(idleStartTime, new Date())
      idleStartTime = null
    }

    lastActivityTime = new Date()

    // Set new idle timer
    idleTimer = setTimeout(() => {
      idleStartTime = new Date()
      onIdleStart(idleStartTime)
    }, idleThreshold * 60 * 1000) // Convert minutes to milliseconds
  }

  // Track user activity
  const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart']
  events.forEach(event => {
    document.addEventListener(event, resetIdleTimer)
  })

  // Initial timer setup
  resetIdleTimer()

  // Return cleanup function
  return () => {
    events.forEach(event => {
      document.removeEventListener(event, resetIdleTimer)
    })
    if (idleTimer) {
      clearTimeout(idleTimer)
    }
    if (idleStartTime) {
      onIdleEnd(idleStartTime, new Date())
    }
  }
}

export function detectIdleTime(record: AttendanceRecord, settings: AttendanceSettings): AttendanceRecord {
  if (!record.checkIn || !record.checkOut) return record

  const checkInTime = new Date(record.checkIn.time)
  const checkOutTime = new Date(record.checkOut.time)
  const workDuration = checkOutTime.getTime() - checkInTime.getTime()
  const workHours = workDuration / (1000 * 60 * 60)

  // Calculate idle time periods
  const idlePeriods = record.idleTime || []
  const totalIdleMinutes = idlePeriods.reduce((total, period) => total + period.duration, 0)

  // Generate flags based on idle time
  const flags = record.flags || []
  
  if (totalIdleMinutes > settings.idleThreshold * settings.maxIdlePeriods) {
    flags.push({
      type: 'multiple_idle_periods',
      description: `Multiple idle periods detected (${idlePeriods.length} periods)`,
      severity: 'high',
      timestamp: new Date()
    })
  }

  // Update record with idle time information
  return {
    ...record,
    idleTime: idlePeriods,
    flags,
    status: determineStatus(record, workHours, totalIdleMinutes, settings)
  }
}

function determineStatus(
  record: AttendanceRecord,
  workHours: number,
  totalIdleMinutes: number,
  settings: AttendanceSettings
): AttendanceRecord['status'] {
  if (workHours < 4) return 'half_day'
  if (workHours < 8) return 'early_leave'
  if (totalIdleMinutes > settings.idleThreshold * settings.maxIdlePeriods) return 'present'
  return 'present'
}

export function calculateAttendanceStats(records: AttendanceRecord[]): AttendanceStats {
  const stats: AttendanceStats = {
    totalDays: records.length,
    presentDays: 0,
    absentDays: 0,
    lateDays: 0,
    earlyLeaveDays: 0,
    halfDays: 0,
    attendanceRate: 0,
    averageIdleTime: 0,
    flags: {
      count: 0,
      byType: {
        irregular_hours: 0,
        multiple_idle_periods: 0,
        location_mismatch: 0,
        device_change: 0
      }
    },
    approvalStats: {
      pending: 0,
      approved: 0,
      rejected: 0
    },
    averageHours: 0,
    overtimeHours: 0,
    pendingApprovals: 0
  }

  let totalIdleMinutes = 0
  let totalWorkHours = 0

  records.forEach(record => {
    // Count status
    switch (record.status) {
      case 'present':
        stats.presentDays++
        break
      case 'absent':
        stats.absentDays++
        break
      case 'late':
        stats.lateDays++
        break
      case 'early_leave':
        stats.earlyLeaveDays++
        break
      case 'half_day':
        stats.halfDays++
        break
    }

    // Count flags
    if (record.flags) {
      stats.flags.count += record.flags.length
      record.flags.forEach(flag => {
        stats.flags.byType[flag.type]++
      })
    }

    // Calculate idle time
    if (record.idleTime) {
      const recordIdleMinutes = record.idleTime.reduce((total, period) => total + period.duration, 0)
      totalIdleMinutes += recordIdleMinutes
    }

    // Calculate work hours
    if (record.checkIn && record.checkOut) {
      const workDuration = new Date(record.checkOut.time).getTime() - new Date(record.checkIn.time).getTime()
      const workHours = workDuration / (1000 * 60 * 60)
      totalWorkHours += workHours
    }

    // Count approval status
    stats.approvalStats[record.approvalStatus]++
  })

  // Calculate averages and rates
  stats.averageIdleTime = records.length > 0 ? totalIdleMinutes / records.length : 0
  stats.averageHours = records.length > 0 ? totalWorkHours / records.length : 0
  stats.attendanceRate = (stats.presentDays / stats.totalDays) * 100

  return stats
} 