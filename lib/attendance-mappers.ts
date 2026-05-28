import type { AttendanceRecord } from '@/types/attendance'

export type AttendanceRow = {
  id: string
  employee_id: string
  employee_name?: string | null
  department?: string | null
  manager_id?: string | null
  date: string
  status: string
  check_in_time?: string | null
  check_out_time?: string | null
  check_in_location?: Record<string, unknown> | null
  check_out_location?: Record<string, unknown> | null
  check_in_device?: Record<string, unknown> | null
  check_out_device?: Record<string, unknown> | null
  idle_time_minutes?: number | null
  total_hours?: number | null
  active_time_minutes?: number | null
  approval_status?: string | null
  notes?: string | null
  flags?: unknown
  created_at?: string
  updated_at?: string
}

export function mapAttendanceRowToClient(row: AttendanceRow): AttendanceRecord {
  const checkInLocation = (row.check_in_location || undefined) as AttendanceRecord['checkIn']['location']
  const checkOutLocation = (row.check_out_location || undefined) as AttendanceRecord['checkOut'] extends infer C
    ? C extends { location?: infer L }
      ? L
      : never
    : never

  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name || '',
    department: row.department || '',
    managerId: row.manager_id || undefined,
    date: new Date(row.date),
    checkIn: {
      time: row.check_in_time ? new Date(row.check_in_time) : new Date(row.date),
      location: checkInLocation,
      deviceInfo: (row.check_in_device || undefined) as AttendanceRecord['checkIn']['deviceInfo'],
    },
    checkOut: row.check_out_time
      ? {
          time: new Date(row.check_out_time),
          location: checkOutLocation,
          deviceInfo: (row.check_out_device || undefined) as NonNullable<
            AttendanceRecord['checkOut']
          >['deviceInfo'],
        }
      : undefined,
    status: (row.status || 'present') as AttendanceRecord['status'],
    totalHours: row.total_hours != null ? Number(row.total_hours) : undefined,
    activeTime: row.active_time_minutes != null ? Number(row.active_time_minutes) : undefined,
    idleTimeTotal: row.idle_time_minutes != null ? Number(row.idle_time_minutes) : undefined,
    notes: row.notes || undefined,
    approvalStatus: (row.approval_status || 'pending') as AttendanceRecord['approvalStatus'],
    flags: Array.isArray(row.flags) ? (row.flags as AttendanceRecord['flags']) : [],
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
  }
}

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}
