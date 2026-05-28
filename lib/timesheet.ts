import { AttendanceRecord, TimesheetSummary } from '@/types/attendance'
import { format, startOfWeek, endOfWeek, addWeeks, startOfDay, endOfDay, isWithinInterval } from 'date-fns'

/**
 * Generate a timesheet summary for a given period
 */
export function generateTimesheetSummary(
  records: AttendanceRecord[],
  employeeId: string,
  employeeName: string,
  periodStart: Date,
  periodEnd: Date,
  periodType: 'daily' | 'weekly' | 'bi-weekly'
): TimesheetSummary {
  // Filter records within the period
  const periodRecords = records.filter(record => {
    const recordDate = new Date(record.date)
    return isWithinInterval(recordDate, { start: periodStart, end: periodEnd })
  })

  // Calculate totals
  let totalHours = 0
  let totalActiveTime = 0 // in minutes
  let totalIdleTime = 0 // in minutes
  const daysWithRecords = new Set<string>()

  const breakdown = periodRecords.map(record => {
    const recordDate = new Date(record.date)
    const clockIn = record.checkIn ? new Date(record.checkIn.time) : null
    const clockOut = record.checkOut ? new Date(record.checkOut.time) : null
    
    // Calculate hours for this record
    const recordHours = record.totalHours || 0
    const recordActiveTime = record.activeTime || 0 // in minutes
    const recordIdleTime = record.idleTimeTotal || 0 // in minutes

    totalHours += recordHours
    totalActiveTime += recordActiveTime
    totalIdleTime += recordIdleTime
    
    const dateKey = format(recordDate, 'yyyy-MM-dd')
    daysWithRecords.add(dateKey)

    return {
      date: recordDate,
      clockIn,
      clockOut,
      totalHours: recordHours,
      activeTime: recordActiveTime,
      idleTime: recordIdleTime,
      status: record.status,
      approvalStatus: record.approvalStatus
    }
  })

  const totalDays = daysWithRecords.size
  const averageHoursPerDay = totalDays > 0 ? totalHours / totalDays : 0
  const averageActiveTimePerDay = totalDays > 0 ? totalActiveTime / totalDays : 0
  const averageIdleTimePerDay = totalDays > 0 ? totalIdleTime / totalDays : 0

  return {
    employeeId,
    employeeName,
    period: {
      start: periodStart,
      end: periodEnd,
      type: periodType
    },
    records: periodRecords,
    totals: {
      totalDays,
      totalHours,
      activeTime: totalActiveTime,
      idleTime: totalIdleTime,
      averageHoursPerDay,
      averageActiveTimePerDay,
      averageIdleTimePerDay
    },
    breakdown
  }
}

/**
 * Generate weekly timesheet summary
 */
export function generateWeeklyTimesheet(
  records: AttendanceRecord[],
  employeeId: string,
  employeeName: string,
  weekStart: Date = startOfWeek(new Date(), { weekStartsOn: 1 })
): TimesheetSummary {
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
  return generateTimesheetSummary(
    records,
    employeeId,
    employeeName,
    weekStart,
    weekEnd,
    'weekly'
  )
}

/**
 * Generate bi-weekly timesheet summary
 */
export function generateBiWeeklyTimesheet(
  records: AttendanceRecord[],
  employeeId: string,
  employeeName: string,
  periodStart: Date = startOfWeek(new Date(), { weekStartsOn: 1 })
): TimesheetSummary {
  const periodEnd = addWeeks(periodStart, 2)
  return generateTimesheetSummary(
    records,
    employeeId,
    employeeName,
    periodStart,
    periodEnd,
    'bi-weekly'
  )
}

/**
 * Generate daily timesheet summary
 */
export function generateDailyTimesheet(
  records: AttendanceRecord[],
  employeeId: string,
  employeeName: string,
  date: Date = new Date()
): TimesheetSummary {
  const dayStart = startOfDay(date)
  const dayEnd = endOfDay(date)
  return generateTimesheetSummary(
    records,
    employeeId,
    employeeName,
    dayStart,
    dayEnd,
    'daily'
  )
}

/**
 * Format minutes to hours and minutes string
 */
export function formatMinutesToHours(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  if (hours === 0) {
    return `${mins}m`
  }
  if (mins === 0) {
    return `${hours}h`
  }
  return `${hours}h ${mins}m`
}

/**
 * Format hours to decimal (e.g., 7.5 hours)
 */
export function formatHours(hours: number): string {
  return hours.toFixed(2)
}

