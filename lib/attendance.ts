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
  if (!record.checkIn) return record

  const flags = record.flags || []
  const checkInTime = new Date(record.checkIn.time)
  const checkOutTime = record.checkOut ? new Date(record.checkOut.time) : null
  
  // Parse working hours
  const [startHour, startMinute] = settings.workingHours.start.split(':').map(Number)
  const [endHour, endMinute] = settings.workingHours.end.split(':').map(Number)
  const workStartTime = new Date(checkInTime)
  workStartTime.setHours(startHour, startMinute, 0, 0)
  const workEndTime = new Date(checkInTime)
  workEndTime.setHours(endHour, endMinute, 0, 0)

  // Check for late check-in
  if (checkInTime > workStartTime) {
    const lateMinutes = Math.floor((checkInTime.getTime() - workStartTime.getTime()) / (1000 * 60))
    if (lateMinutes > settings.allowedLateMinutes) {
      flags.push({
        type: 'irregular_hours',
        description: `Late check-in by ${lateMinutes} minutes`,
        severity: lateMinutes > 30 ? 'high' : 'medium',
        timestamp: new Date()
      })
    }
  }

  // Check for early check-out
  if (checkOutTime && checkOutTime < workEndTime) {
    const earlyMinutes = Math.floor((workEndTime.getTime() - checkOutTime.getTime()) / (1000 * 60))
    if (earlyMinutes > settings.allowedLateMinutes) {
      flags.push({
        type: 'irregular_hours',
        description: `Early check-out by ${earlyMinutes} minutes`,
        severity: earlyMinutes > 30 ? 'high' : 'medium',
        timestamp: new Date()
      })
    }
  }

  // Calculate work duration and idle time
  const workDuration = checkOutTime ? checkOutTime.getTime() - checkInTime.getTime() : 0
  const workHours = workDuration / (1000 * 60 * 60)
  const idlePeriods = record.idleTime || []
  const totalIdleMinutes = idlePeriods.reduce((total, period) => total + period.duration, 0)

  // Flag for excessive idle time
  if (totalIdleMinutes > settings.idleThreshold * settings.maxIdlePeriods) {
    flags.push({
      type: 'multiple_idle_periods',
      description: `Multiple idle periods detected (${idlePeriods.length} periods, total ${Math.round(totalIdleMinutes)} minutes)`,
      severity: totalIdleMinutes > 120 ? 'high' : 'medium',
      timestamp: new Date()
    })
  }

  // Flag for irregular work hours
  if (workHours > 0) {
    if (workHours < 4) {
      flags.push({
        type: 'irregular_hours',
        description: 'Work duration less than 4 hours',
        severity: 'high',
        timestamp: new Date()
      })
    } else if (workHours > 12) {
      flags.push({
        type: 'irregular_hours',
        description: 'Work duration exceeds 12 hours',
        severity: 'medium',
        timestamp: new Date()
      })
    }
  }

  // Flag for device changes if device info is available
  if (record.checkIn.deviceInfo && record.checkOut?.deviceInfo) {
    const checkInDevice = record.checkIn.deviceInfo
    const checkOutDevice = record.checkOut.deviceInfo
    
    if (checkInDevice.browser !== checkOutDevice.browser || 
        checkInDevice.os !== checkOutDevice.os) {
      flags.push({
        type: 'device_change',
        description: 'Device changed between check-in and check-out',
        severity: 'medium',
        timestamp: new Date()
      })
    }
  }

  // Update record with flags and status
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