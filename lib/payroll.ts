import { db } from './firebase'
import { collection, doc, addDoc, updateDoc, query, where, getDocs, getDoc, Timestamp, orderBy } from '@/lib/data/firestore'
import { PayrollData, PayrollFormData } from '@/types/payroll'
import { ProductivityService } from './productivity'
import { settingsService } from './settings'

export interface ProductivityBasedPayroll {
  employeeId: string
  employeeName: string
  department: string
  baseSalary: number
  productivityScore: number
  attendanceRate: number
  performanceBonus: number
  attendanceBonus: number
  totalBonus: number
  grossSalary: number
  deductions: {
    tax: number
    insurance: number
    other: number
  }
  netPay: number
  month: string
  year: number
  processedAt: Date
  notes?: string
}

export class PayrollService {
  private productivityService: ProductivityService
  private db: any

  constructor(dbInstance?: any) {
    this.db = dbInstance
    // Initialize with safe defaults for productivity service
    try {
      const defaultSettings = {
        trackingEnabled: true,
        idleThreshold: 5,
        syncInterval: 30,
        collectUrls: true,
        collectTitles: true,
        retentionPeriod: 90,
        productiveDomains: [],
        productiveSites: [],
        unproductiveSites: [],
        workingHours: {
          start: '09:00',
          end: '17:00'
        },
        breakDuration: 60,
        targetProductiveHours: 6,
        focusSessionDuration: 25,
        maxFocusSessionsPerDay: 8,
        minFocusTimePercentage: 60,
        maxMeetingTimePercentage: 30,
        productivityThresholds: {
          low: 50,
          medium: 75,
          high: 90
        },
        notificationPreferences: {
          focusReminders: true,
          breakReminders: true,
          productivityAlerts: true,
          meetingReminders: true
        }
      }
      this.productivityService = ProductivityService.getInstance(defaultSettings, defaultSettings)
    } catch (error) {
      console.warn('Failed to initialize ProductivityService, will use fallbacks:', error)
    }
  }

  /**
   * Calculate performance-based bonuses using configurable settings
   */
  async calculateProductivityBonus(
    employeeId: string,
    baseSalary: number,
    startDate: Date,
    endDate: Date
  ): Promise<{
    productivityScore: number
    performanceBonus: number
    attendanceBonus: number
    totalBonus: number
  }> {
    try {
      // Get productivity analytics for the period
      const productivityAnalytics = await this.productivityService.calculateProductivityAnalytics(
        employeeId,
        startDate,
        endDate
      )

      // Get attendance records for the period
      const attendanceQuery = query(
        collection(this.db, 'attendance'),
        where('employeeId', '==', employeeId),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      )
      const attendanceSnapshot = await getDocs(attendanceQuery)
      const attendanceRecords = attendanceSnapshot.docs.map(doc => doc.data())

      // Calculate productivity score (0-100)
      const productivityScore = productivityAnalytics.overview.averageProductivityScore

      // Calculate attendance rate
      const totalDays = attendanceRecords.length
      const presentDays = attendanceRecords.filter(record => record.status === 'present').length
      const attendanceRate = totalDays > 0 ? (presentDays / totalDays) * 100 : 0

      // Calculate bonuses using configurable settings
      const performanceBonus = await settingsService.calculateProductivityBonus(productivityScore, baseSalary)
      const attendanceBonus = await settingsService.calculateAttendanceBonus(attendanceRate, baseSalary)

      const totalBonus = performanceBonus + attendanceBonus

      return {
        productivityScore,
        performanceBonus,
        attendanceBonus,
        totalBonus
      }
    } catch (error) {
      console.error('Error calculating productivity bonus:', error)
      return {
        productivityScore: 0,
        performanceBonus: 0,
        attendanceBonus: 0,
        totalBonus: 0
      }
    }
  }

  /**
   * Process payroll with configurable settings
   */
  async processProductivityBasedPayroll(
    employeeId: string,
    month: string,
    year: number,
    baseSalary: number,
    customDeductions?: {
      tax: number
      insurance: number
      other: number
    }
  ): Promise<ProductivityBasedPayroll> {
    try {
      console.log('Starting payroll processing for:', { employeeId, month, year, baseSalary })
      
      // Validate Firebase connection
      if (!db) {
        throw new Error('Firebase database not initialized')
      }
      
      // Get employee details - try users collection first, then employees
      let employeeDoc = await getDoc(doc(this.db, 'users', employeeId))
      if (!employeeDoc.exists()) {
        employeeDoc = await getDoc(doc(this.db, 'employees', employeeId))
        if (!employeeDoc.exists()) {
          throw new Error('Employee not found')
        }
      }
      const employee = employeeDoc.data()
      console.log('Found employee:', { 
        id: employeeId, 
        name: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
        department: employee.department 
      })

      // Get payroll settings (for exchange rate)
      let convertedBaseSalary = baseSalary
      try {
        const payrollSettings = await settingsService.getPayrollSettings()
        if (payrollSettings.exchangeRate && payrollSettings.exchangeRate > 0) {
          convertedBaseSalary = baseSalary * payrollSettings.exchangeRate
        }
      } catch (error) {
        console.warn('Failed to get payroll settings, using base salary:', error)
      }

      // Calculate date range for the month
      const startDate = new Date(year, parseInt(month) - 1, 1)
      const endDate = new Date(year, parseInt(month), 0)
      console.log('Date range:', { startDate, endDate, month, year })

      // Calculate productivity-based bonuses using settings
      let bonusCalculation
      try {
        bonusCalculation = await this.calculateProductivityBonus(
          employeeId,
          convertedBaseSalary,
          startDate,
          endDate
        )
      } catch (error) {
        console.warn('Failed to calculate productivity bonus, using defaults:', error)
        bonusCalculation = {
          productivityScore: 0,
          performanceBonus: 0,
          attendanceBonus: 0,
          totalBonus: 0
        }
      }

      // Calculate deductions using configurable settings
      const grossSalary = convertedBaseSalary + bonusCalculation.totalBonus
      let deductions
      if (customDeductions) {
        deductions = customDeductions
      } else {
        const calculatedDeductions = await settingsService.calculateDeductions(convertedBaseSalary, grossSalary)
        deductions = {
          tax: calculatedDeductions.tax || 0,
          insurance: calculatedDeductions.insurance || 0,
          other: (calculatedDeductions.other || 0) + (calculatedDeductions.pension || 0)
        }
      }

      const totalDeductions = deductions.tax + deductions.insurance + deductions.other
      const netPay = grossSalary - totalDeductions
      
      console.log('Payroll calculations:', {
        convertedBaseSalary,
        bonusCalculation,
        grossSalary,
        deductions,
        totalDeductions,
        netPay
      })

      const payrollData: ProductivityBasedPayroll = {
        employeeId,
        employeeName: `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || 'Unknown Employee',
        department: employee.department || 'Unassigned',
        baseSalary: convertedBaseSalary,
        productivityScore: bonusCalculation.productivityScore,
        attendanceRate: bonusCalculation.attendanceBonus > 0 ? 95 : 85, // Placeholder
        performanceBonus: bonusCalculation.performanceBonus,
        attendanceBonus: bonusCalculation.attendanceBonus,
        totalBonus: bonusCalculation.totalBonus,
        grossSalary,
        deductions: {
          tax: deductions.tax,
          insurance: deductions.insurance,
          other: deductions.other
        },
        netPay,
        month,
        year,
        processedAt: new Date()
      }

      // Save to Firestore
      console.log('Saving payroll data to Firestore:', payrollData)
      const docRef = await addDoc(collection(this.db, 'payrollEntries'), payrollData)
      console.log('Payroll saved successfully with ID:', docRef.id)

      return payrollData
    } catch (error) {
      console.error('Error processing productivity-based payroll:', error)
      throw error
    }
  }

  /**
   * Get payroll history for an employee
   */
  async getEmployeePayrollHistory(employeeId: string): Promise<ProductivityBasedPayroll[]> {
    try {
          const payrollQuery = query(
      collection(this.db, 'payrollEntries'),
      where('employeeId', '==', employeeId),
      orderBy('processedAt', 'desc')
    )
      const snapshot = await getDocs(payrollQuery)
      
      return snapshot.docs.map(doc => ({
        ...doc.data(),
        processedAt: doc.data().processedAt.toDate()
      })) as ProductivityBasedPayroll[]
    } catch (error) {
      console.error('Error fetching payroll history:', error)
      return []
    }
  }

  /**
   * Get department payroll summary
   */
  async getDepartmentPayrollSummary(department: string, month: string, year: number): Promise<{
    totalPayroll: number
    averageProductivity: number
    totalBonuses: number
    employeeCount: number
    topPerformers: number
  }> {
    try {
      const startDate = new Date(year, parseInt(month) - 1, 1)
      const endDate = new Date(year, parseInt(month), 0)

      const payrollQuery = query(
        collection(this.db, 'payrollEntries'),
        where('department', '==', department),
        where('month', '==', month),
        where('year', '==', year)
      )
      const snapshot = await getDocs(payrollQuery)
      const payrollEntries = snapshot.docs.map(doc => doc.data()) as ProductivityBasedPayroll[]

      const totalPayroll = payrollEntries.reduce((sum, entry) => sum + entry.netPay, 0)
      const averageProductivity = payrollEntries.reduce((sum, entry) => sum + entry.productivityScore, 0) / payrollEntries.length
      const totalBonuses = payrollEntries.reduce((sum, entry) => sum + entry.totalBonus, 0)
      const employeeCount = payrollEntries.length
      const topPerformers = payrollEntries.filter(entry => entry.productivityScore >= 90).length

      return {
        totalPayroll,
        averageProductivity,
        totalBonuses,
        employeeCount,
        topPerformers
      }
    } catch (error) {
      console.error('Error fetching department payroll summary:', error)
      return {
        totalPayroll: 0,
        averageProductivity: 0,
        totalBonuses: 0,
        employeeCount: 0,
        topPerformers: 0
      }
    }
  }

  /**
   * Generate payroll insights for dashboard
   */
  async getPayrollInsights(): Promise<{
    totalPayrollThisMonth: number
    averageProductivity: number
    totalBonusesDistributed: number
    topPerformingDepartments: Array<{
      department: string
      averageProductivity: number
      totalBonuses: number
    }>
  }> {
    try {
      const currentDate = new Date()
      const currentMonth = (currentDate.getMonth() + 1).toString()
      const currentYear = currentDate.getFullYear()

      // Get all payroll entries for current month
      const payrollQuery = query(
        collection(this.db, 'payrollEntries'),
        where('month', '==', currentMonth),
        where('year', '==', currentYear)
      )
      const snapshot = await getDocs(payrollQuery)
      const payrollEntries = snapshot.docs.map(doc => doc.data()) as ProductivityBasedPayroll[]

      const totalPayrollThisMonth = payrollEntries.reduce((sum, entry) => sum + entry.netPay, 0)
      const averageProductivity = payrollEntries.reduce((sum, entry) => sum + entry.productivityScore, 0) / payrollEntries.length
      const totalBonusesDistributed = payrollEntries.reduce((sum, entry) => sum + entry.totalBonus, 0)

      // Group by department
      const departmentStats = payrollEntries.reduce((acc, entry) => {
        if (!acc[entry.department]) {
          acc[entry.department] = {
            totalProductivity: 0,
            totalBonuses: 0,
            count: 0
          }
        }
        acc[entry.department].totalProductivity += entry.productivityScore
        acc[entry.department].totalBonuses += entry.totalBonus
        acc[entry.department].count++
        return acc
      }, {} as Record<string, { totalProductivity: number; totalBonuses: number; count: number }>)

      const topPerformingDepartments = Object.entries(departmentStats)
        .map(([department, stats]) => ({
          department,
          averageProductivity: stats.totalProductivity / stats.count,
          totalBonuses: stats.totalBonuses
        }))
        .sort((a, b) => b.averageProductivity - a.averageProductivity)
        .slice(0, 5)

      return {
        totalPayrollThisMonth,
        averageProductivity,
        totalBonusesDistributed,
        topPerformingDepartments
      }
    } catch (error) {
      console.error('Error generating payroll insights:', error)
      return {
        totalPayrollThisMonth: 0,
        averageProductivity: 0,
        totalBonusesDistributed: 0,
        topPerformingDepartments: []
      }
    }
  }
}

// Create and export singleton instance with error handling
let payrollServiceInstance: PayrollService | null = null

export const payrollService = (() => {
  // Check if we're on the client side
  if (typeof window !== 'undefined') {
    // Return a client-side safe version that uses API calls
    return {
      processProductivityBasedPayroll: async (employeeId: string, month: string, year: number, baseSalary: number) => {
        const response = await fetch('/api/payroll/payslip-working', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employeeId, month, year })
        })
        if (!response.ok) {
          throw new Error('Failed to process payroll')
        }
        return response.json()
      },
      getEmployeePayrollHistory: async () => [],
      calculatePayrollForDepartment: async () => [],
      getPayrollSummary: async () => ({ totalEmployees: 0, totalGrossPay: 0, totalNetPay: 0, totalDeductions: 0 }),
      calculateProductivityBonus: async () => ({ productivityScore: 0, performanceBonus: 0, attendanceBonus: 0, totalBonus: 0 }),
      getPayrollInsights: async () => {
        const response = await fetch('/api/payroll/insights')
        if (!response.ok) {
          return { averageProductivity: 0, totalPayrollThisMonth: 0, totalBonusesDistributed: 0 }
        }
        return response.json()
      }
    } as any
  }

  // Server-side initialization - use dynamic import to avoid bundling issues
  try {
    if (!payrollServiceInstance) {
      // Use dynamic import to avoid bundling Firebase Admin SDK
      import('./firebase').then(({ db }) => {
        payrollServiceInstance = new PayrollService(db)
      }).catch(error => {
        console.error('Failed to import Firebase for PayrollService:', error)
      })
    }
    return payrollServiceInstance || {
      processProductivityBasedPayroll: async () => {
        throw new Error('PayrollService not properly initialized')
      },
      getEmployeePayrollHistory: async () => [],
      calculatePayrollForDepartment: async () => [],
      getPayrollSummary: async () => ({ totalEmployees: 0, totalGrossPay: 0, totalNetPay: 0, totalDeductions: 0 }),
      calculateProductivityBonus: async () => ({ productivityScore: 0, performanceBonus: 0, attendanceBonus: 0, totalBonus: 0 })
    } as any
  } catch (error) {
    console.error('Failed to initialize PayrollService:', error)
    // Return a minimal service that can still function
    return {
      processProductivityBasedPayroll: async () => {
        throw new Error('PayrollService not properly initialized')
      },
      getEmployeePayrollHistory: async () => [],
      calculatePayrollForDepartment: async () => [],
      getPayrollSummary: async () => ({ totalEmployees: 0, totalGrossPay: 0, totalNetPay: 0, totalDeductions: 0 }),
      calculateProductivityBonus: async () => ({ productivityScore: 0, performanceBonus: 0, attendanceBonus: 0, totalBonus: 0 })
    } as any
  }
})()

// Export a function to create payroll service with admin SDK for server-side use
export const createAdminPayrollService = async () => {
  // Only allow this on the server side
  if (typeof window !== 'undefined') {
    throw new Error('Admin PayrollService cannot be used on the client side')
  }
  
  try {
    const { adminDb } = await import('./firebase-admin')
    return new PayrollService(adminDb)
  } catch (error) {
    console.error('Failed to create admin PayrollService:', error)
    throw error
  }
} 