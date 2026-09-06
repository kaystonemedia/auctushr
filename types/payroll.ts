export interface Employee {
  id: string
  name: string
  email: string
  department: string
  baseSalary: number
}

export interface PayrollData {
  employeeId: string
  employeeName: string
  department: string
  baseSalary: number
  bonuses: {
    performance: number
    overtime: number
    other: number
  }
  deductions: {
    tax: number
    insurance: number
    other: number
  }
  totalBonuses: number
  totalDeductions: number
  netPay: number
  status: 'Pending' | 'Paid' | 'Failed'
  month: string
  createdAt: Date
  notes?: string
}

export interface PayrollFormData {
  baseSalary: number
  bonuses: {
    performance: number
    overtime: number
    other: number
  }
  deductions: {
    tax: number
    insurance: number
    other: number
  }
  notes: string
}

export interface PayrollPeriod {
  id: string
  startDate: Date
  endDate: Date
  status: 'pending' | 'processing' | 'completed' | 'cancelled'
  createdAt: Date
  updatedAt: Date
}

export interface PayrollDeduction {
  type: 'tax' | 'insurance' | 'loan' | 'paye' | 'ssnit' | 'other'
  name: string
  amount: number
  description?: string
}

export interface PayrollAllowance {
  type: 'housing' | 'transportation' | 'meal' | 'other'
  name: string
  amount: number
  description?: string
}

export interface PayrollEntry {
  id: string
  employeeId: string
  employeeName: string
  employeeCode?: string
  departmentId: string
  periodId: string
  /** Display-friendly duplicate of periodId, as returned by the entries API. */
  period?: string
  /** Biweekly period boundaries (the source of truth going forward). */
  periodStartDate?: Date | string
  periodEndDate?: Date | string
  /** 'monthly_legacy' marks entries created before the biweekly migration. */
  payFrequency?: 'biweekly' | 'monthly_legacy'
  /** Snapshotted at generation time from attendance records for the period. */
  daysWorked?: number
  daysAbsent?: number
  /** Display/payout currency and the USD exchange rate snapshotted at generation time. */
  currency?: string
  exchangeRate?: number
  basicSalary: number
  allowances: PayrollAllowance[]
  deductions: PayrollDeduction[]
  overtimeHours: number
  overtimeRate: number
  bonus: number
  netSalary: number
  grossSalary: number
  status: 'pending' | 'processed' | 'paid' | 'cancelled'
  paymentDate?: Date
  paymentMethod: 'bank_transfer' | 'cash' | 'check'
  bankDetails?: {
    accountNumber: string
    bankName: string
    accountName: string
    branch?: string
  }
  notes?: string
  createdAt: Date
  updatedAt: Date
}

export interface PayrollReport {
  periodId: string
  startDate: Date
  endDate: Date
  totalGrossSalary: number
  totalNetSalary: number
  totalDeductions: number
  totalAllowances: number
  totalOvertime: number
  totalBonus: number
  employeeCount: number
  status: 'pending' | 'processing' | 'completed' | 'cancelled'
  entries: PayrollEntry[]
  summary: {
    byDepartment: Record<string, {
      grossSalary: number
      netSalary: number
      employeeCount: number
      status: {
        pending: number
        processed: number
        total: number
      }
    }>
    byStatus: Record<string, number>
  }
} 