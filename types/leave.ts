export type LeaveType = 'annual' | 'sick' | 'personal' | 'maternity' | 'paternity' | 'bereavement' | 'unpaid'
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface LeaveRequest {
  id: string
  employeeId: string
  employeeName: string
  department: string
  type: LeaveType
  startDate: Date
  endDate: Date
  status: LeaveStatus
  reason: string
  createdAt: Date
  updatedAt: Date
  approvedBy?: string
  approvedAt?: Date
  rejectedBy?: string
  rejectedAt?: Date
  cancelledBy?: string
  cancelledAt?: Date
  attachments?: string[]
}

export interface LeaveBalance {
  employeeId: string
  year: number
  annual: number
  sick: number
  personal: number
  maternity: number
  paternity: number
  bereavement: number
  unpaid: number
  updatedAt: Date
}

export interface LeavePolicy {
  department: string
  annual: number
  sick: number
  personal: number
  maternity: number
  paternity: number
  bereavement: number
  unpaid: number
  updatedAt: Date
} 