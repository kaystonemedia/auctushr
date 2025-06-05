import { AttendanceRecord, AttendanceStats } from './attendance'

export interface AttendanceReport {
  type: 'summary' | 'detailed' | 'custom'
  dateRange: {
    from: Date
    to: Date
  }
  employee?: {
    id: string
    name: string
  }
  stats: AttendanceStats
  records: (AttendanceRecord & {
    productivity?: number
    efficiency?: number
  })[]
}

export interface ReportTemplate {
  id: string
  name: string
  description: string
  type: 'summary' | 'detailed' | 'custom'
  filters: {
    dateRange?: boolean
    employee?: boolean
    department?: boolean
    status?: boolean
  }
  columns: string[]
  calculations: string[]
  format: 'excel' | 'pdf'
  createdAt: Date
  updatedAt: Date
  createdBy: string
  isDefault: boolean
} 