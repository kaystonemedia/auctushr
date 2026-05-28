import type { LeaveRequest, LeaveBalance } from '@/types/leave'

type LeaveRow = {
  id: string
  employee_id: string
  manager_id: string | null
  type: string
  start_date: string
  end_date: string
  status: string
  reason: string | null
  attachments: unknown
  approved_by: string | null
  approved_at: string | null
  rejected_by: string | null
  rejected_at: string | null
  created_at: string
  updated_at: string
  profiles?: { first_name?: string; last_name?: string; department?: string; email?: string } | null
}

type BalanceRow = {
  id: string
  employee_id: string
  year: number
  annual: number
  sick: number
  personal: number
  maternity: number
  paternity: number
  bereavement: number
  unpaid: number
  updated_at: string
}

export function mapLeaveRow(row: LeaveRow): LeaveRequest {
  const profile = row.profiles as LeaveRow['profiles']
  const name = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
    : ''
  return {
    id: row.id,
    employeeId: row.employee_id,
    managerId: row.manager_id,
    employeeName: name || profile?.email || 'Unknown',
    department: profile?.department || 'Unassigned',
    type: row.type as LeaveRequest['type'],
    startDate: new Date(row.start_date),
    endDate: new Date(row.end_date),
    status: row.status as LeaveRequest['status'],
    reason: row.reason || '',
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    approvedBy: row.approved_by || undefined,
    approvedAt: row.approved_at ? new Date(row.approved_at) : undefined,
    rejectedBy: row.rejected_by || undefined,
    rejectedAt: row.rejected_at ? new Date(row.rejected_at) : undefined,
    attachments: Array.isArray(row.attachments) ? (row.attachments as string[]) : [],
  }
}

export function mapBalanceRow(row: BalanceRow): LeaveBalance {
  return {
    employeeId: row.employee_id,
    year: row.year,
    annual: row.annual,
    sick: row.sick,
    personal: row.personal,
    maternity: row.maternity,
    paternity: row.paternity,
    bereavement: row.bereavement,
    unpaid: row.unpaid,
    updatedAt: new Date(row.updated_at),
  }
}

export function defaultLeaveBalance(employeeId: string, year: number): LeaveBalance {
  return {
    employeeId,
    year,
    annual: 20,
    sick: 10,
    personal: 5,
    maternity: 90,
    paternity: 10,
    bereavement: 5,
    unpaid: 0,
    updatedAt: new Date(),
  }
}
