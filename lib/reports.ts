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
          productivity: record.hoursWorked ? (record.hoursWorked / 8) * 100 : 0,
          efficiency: record.idleTime ? ((record.hoursWorked || 0) - record.idleTime) / (record.hoursWorked || 1) * 100 : 0
        }))
      }

    default:
      throw new Error('Invalid report type')
  }
} 