import { AttendanceRecord, AttendanceStats } from '@/types/attendance'
import { AttendanceReport } from '@/types/reports'
import { calculateAttendanceStats } from './attendance'

interface GenerateReportOptions {
  records: AttendanceRecord[]
  stats: AttendanceStats
  type: 'summary' | 'detailed' | 'custom'
  dateRange: {
    from: Date
    to: Date
  }
  employee?: {
    id: string
    name: string
  }
}

export async function generateAttendanceReport(options: GenerateReportOptions): Promise<AttendanceReport> {
  const { records, stats, type, dateRange, employee } = options

  // Filter records by date range and employee if specified
  const filteredRecords = records.filter(record => {
    const recordDate = new Date(record.date)
    return (
      recordDate >= dateRange.from &&
      recordDate <= dateRange.to &&
      (!employee || record.employeeId === employee.id)
    )
  })

  // Calculate stats for the filtered records
  const filteredStats = calculateAttendanceStats(filteredRecords)

  // Generate report based on type
  switch (type) {
    case 'summary':
      return {
        type: 'summary',
        dateRange,
        employee,
        stats: filteredStats,
        records: filteredRecords.map(record => ({
          ...record,
          // Only include essential fields for summary
          notes: undefined,
          location: undefined,
          idleTime: undefined,
          breakDuration: undefined
        }))
      }

    case 'detailed':
      return {
        type: 'detailed',
        dateRange,
        employee,
        stats: filteredStats,
        records: filteredRecords
      }

    case 'custom':
      // For custom reports, we can add more specific filtering and formatting
      return {
        type: 'custom',
        dateRange,
        employee,
        stats: filteredStats,
        records: filteredRecords.map(record => ({
          ...record,
          // Add any custom calculations or transformations here
          productivity: (() => {
            const hoursWorked = record.checkIn && record.checkOut 
              ? (record.checkOut.time.getTime() - record.checkIn.time.getTime()) / (1000 * 60 * 60)
              : 0
            return hoursWorked ? (hoursWorked / 8) * 100 : 0
          })(),
          efficiency: (() => {
            const hoursWorked = record.checkIn && record.checkOut 
              ? (record.checkOut.time.getTime() - record.checkIn.time.getTime()) / (1000 * 60 * 60)
              : 0
            const idleTimeHours = record.idleTime ? (typeof record.idleTime === 'number' ? record.idleTime / 60 : 0) : 0
            return idleTimeHours > 0 ? ((hoursWorked || 0) - idleTimeHours) / (hoursWorked || 1) * 100 : 0
          })()
        }))
      }

    default:
      throw new Error('Invalid report type')
  }
} 