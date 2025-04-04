export interface AttendanceSettings {
  workingHours: {
    start: string
    end: string
  }
  idleThreshold: number
  maxIdlePeriods: number
  allowedLateMinutes: number
  locationRadius: number
  requiredCheckInDays: string[]
  requireManagerApproval: boolean
  autoApproveThreshold: number
}

export interface SystemSettings {
  companyName: string
  timezone: string
  dateFormat: string
  language: string
  emailNotifications: boolean
  smsNotifications: boolean
} 