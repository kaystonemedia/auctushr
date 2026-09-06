'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { formatCurrency } from '@/lib/utils'
import { Loader2, Calculator, TrendingUp, Clock, Calendar, DollarSign } from 'lucide-react'
import { settingsClientService } from '@/lib/settings-client'
import { ProductivityService } from '@/lib/productivity'
import { GenericPayrollItem } from '@/lib/generic-payment-service'
import { getBiweeklyPeriodForDate, periodStartDateString, periodEndDateString } from '@/lib/pay-periods'

interface EnhancedPayrollFormProps {
  employee: {
    id: string
    name: string
    department?: string
    salary?: number
    mobileNumber?: string
    bankAccount?: {
      accountNumber: string
      bankCode: string
      accountName?: string
    }
  }
  onSuccess: () => void
  onCancel: () => void
}

interface PayrollCalculation {
  baseSalary: number
  productivity: {
    score: number
    bonus: number
    description: string
  }
  attendance: {
    rate: number
    bonus: number
    description: string
  }
  overtime: {
    hours: number
    pay: number
    rate: number
  }
  deductions: {
    tax: number
    insurance: number
    pension: number
    other: number
    total: number
  }
  summary: {
    grossSalary: number
    totalDeductions: number
    netSalary: number
  }
}

export function EnhancedPayrollForm({ employee, onSuccess, onCancel }: EnhancedPayrollFormProps) {
  const [loading, setLoading] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [baseSalary, setBaseSalary] = useState(employee.salary || 0)
  const [calculation, setCalculation] = useState<PayrollCalculation | null>(null)
  const [notes, setNotes] = useState('')
  const [paymentProcessing, setPaymentProcessing] = useState(false)
  const [paymentResult, setPaymentResult] = useState<any>(null)
  
  const [productivityService, setProductivityService] = useState<ProductivityService | null>(null)

  // Debug: Log employee data received by the form
  console.log('EnhancedPayrollForm received employee:', employee);

  // Validation check
  if (!employee || !employee.id || !employee.name) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 text-center text-red-600">
            Invalid employee data. Please try again.
          </div>
        </CardContent>
      </Card>
    )
  }

  const calculatePayroll = async () => {
    if (!baseSalary || baseSalary <= 0) {
      setError('Please enter a valid base salary')
      return
    }

    setCalculating(true)
    setError(null)

    try {
      // Get current month's date range
      const currentDate = new Date()
      const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

      // Calculate productivity analytics
      const productivityAnalytics = productivityService ? await productivityService.calculateProductivityAnalytics(
        employee.id,
        startDate,
        endDate
      ) : {
        overview: {
          averageProductivityScore: 0,
          taskCompletionRate: 0,
          focusTimePercentage: 0,
          meetingEfficiency: 0,
          totalFocusSessions: 0,
          totalTasksCompleted: 0,
          totalMeetingHours: 0
        },
        trends: {
          daily: [],
          weekly: [],
          monthly: []
        },
        projectWise: [],
        teamStats: []
      }

      // Calculate attendance rate
      const attRes = await fetch(
        `/api/attendance/records?employeeId=${employee.id}&fromDate=${startDate.toISOString().slice(0, 10)}&toDate=${endDate.toISOString().slice(0, 10)}`,
        { credentials: 'include' }
      )
      const attData = attRes.ok ? await attRes.json() : { records: [] }
      const attendanceRecords = (attData.records || []).map((r: { status: string; checkIn?: { time: string }; checkOut?: { time: string } }) => ({
        status: r.status,
        checkIn: r.checkIn ? { time: new Date(r.checkIn.time) } : null,
        checkOut: r.checkOut ? { time: new Date(r.checkOut.time) } : null,
      }))
      
      const totalDays = attendanceRecords.length
      const presentDays = attendanceRecords.filter(record => record.status === 'present').length
      const attendanceRate = totalDays > 0 ? (presentDays / totalDays) * 100 : 0

      // Calculate overtime hours
      const overtimeHours = attendanceRecords.reduce((total, record) => {
        if (record.checkIn && record.checkOut) {
          const workDuration = new Date(record.checkOut.time).getTime() - new Date(record.checkIn.time).getTime()
          const workHours = workDuration / (1000 * 60 * 60)
          return total + Math.max(0, workHours - 8) // Assuming 8 hours is standard
        }
        return total
      }, 0)

      // Get bonus calculations from settings
      const productivityBonus = await settingsClientService.calculateProductivityBonus(
        productivityAnalytics.overview.averageProductivityScore,
        baseSalary
      )
      
      const attendanceBonus = await settingsClientService.calculateAttendanceBonus(
        attendanceRate,
        baseSalary
      )

      // Calculate overtime pay
      const hourlyRate = baseSalary / (30 * 8) // Assuming 30 days, 8 hours per day
      const overtimePay = await settingsClientService.calculateOvertimePay(
        8 * totalDays,
        overtimeHours,
        hourlyRate
      )

      // Calculate gross salary
      const grossSalary = baseSalary + productivityBonus + attendanceBonus + overtimePay

      // Calculate deductions
      const deductions = await settingsClientService.calculateDeductions(baseSalary, grossSalary)

      // Calculate net salary
      const netSalary = grossSalary - deductions.total

      // Get bonus tier descriptions
      const payrollSettings = await settingsClientService.getPayrollSettings()
      const productivityTier = payrollSettings.bonusStructure.productivity.tiers.find(
        tier => productivityAnalytics.overview.averageProductivityScore >= tier.minScore && 
                productivityAnalytics.overview.averageProductivityScore <= tier.maxScore
      )
      
      const attendanceTier = payrollSettings.bonusStructure.attendance.tiers.find(
        tier => attendanceRate >= tier.minRate && attendanceRate <= tier.maxRate
      )

      setCalculation({
        baseSalary,
        productivity: {
          score: productivityAnalytics.overview.averageProductivityScore,
          bonus: productivityBonus,
          description: productivityTier?.description || 'No bonus tier'
        },
        attendance: {
          rate: attendanceRate,
          bonus: attendanceBonus,
          description: attendanceTier?.description || 'No bonus tier'
        },
        overtime: {
          hours: overtimeHours,
          pay: overtimePay,
          rate: payrollSettings.bonusStructure.overtime.rate
        },
        deductions: {
          tax: deductions.tax,
          insurance: deductions.insurance,
          pension: deductions.pension,
          other: deductions.other,
          total: deductions.total
        },
        summary: {
          grossSalary,
          totalDeductions: deductions.total,
          netSalary
        }
      })

    } catch (err) {
      console.error('Error calculating payroll:', err)
      setError(err instanceof Error ? err.message : 'Failed to calculate payroll')
    } finally {
      setCalculating(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!calculation) {
      setError('Please calculate payroll first')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Create payroll entry
      const payrollEntry = {
        employeeId: employee.id,
        employeeName: employee.name,
        department: employee.department || 'Unassigned',
        baseSalary: calculation.baseSalary,
        bonuses: {
          performance: calculation.productivity.bonus,
          attendance: calculation.attendance.bonus,
          overtime: calculation.overtime.pay
        },
        deductions: {
          tax: calculation.deductions.tax,
          insurance: calculation.deductions.insurance,
          pension: calculation.deductions.pension,
          other: calculation.deductions.other
        },
        grossSalary: calculation.summary.grossSalary,
        netSalary: calculation.summary.netSalary,
        totalBonuses: calculation.productivity.bonus + calculation.attendance.bonus + calculation.overtime.pay,
        totalDeductions: calculation.deductions.total,
        productivityScore: calculation.productivity.score,
        attendanceRate: calculation.attendance.rate,
        overtimeHours: calculation.overtime.hours,
        notes,
        processedAt: new Date().toISOString(),
        status: 'processed'
      }

      const currentPeriod = getBiweeklyPeriodForDate(new Date())
      const res = await fetch('/api/payroll/entries', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: employee.id,
          periodStartDate: periodStartDateString(currentPeriod),
          periodEndDate: periodEndDateString(currentPeriod),
          basicSalary: calculation.baseSalary,
          grossSalary: calculation.summary.grossSalary,
          netSalary: calculation.summary.netSalary,
          allowances: [
            { type: 'other', name: 'Performance', amount: calculation.productivity.bonus },
            { type: 'other', name: 'Attendance', amount: calculation.attendance.bonus },
            { type: 'other', name: 'Overtime', amount: calculation.overtime.pay },
          ],
          deductions: [
            { type: 'tax', name: 'Tax', amount: calculation.deductions.tax },
            { type: 'insurance', name: 'Insurance', amount: calculation.deductions.insurance },
            { type: 'other', name: 'Pension', amount: calculation.deductions.pension },
          ],
          overtimeHours: calculation.overtime.hours,
          notes,
          status: 'processed',
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to save payroll entry')
      }
      onSuccess()
    } catch (err) {
      console.error('Error processing payroll:', err)
      setError(err instanceof Error ? err.message : 'Failed to process payroll')
    } finally {
      setLoading(false)
    }
  }

  const handlePaymentProcessing = async () => {
    if (!calculation) {
      setError('Please calculate payroll first')
      return
    }

    setPaymentProcessing(true)
    setError(null)

    try {
      // Get payroll settings for currency
      let payrollSettings
      try {
        payrollSettings = await settingsClientService.getPayrollSettings()
      } catch (error) {
        console.error('Error getting payroll settings, using fallback:', error)
        // Use fallback settings if Firebase settings fail
        payrollSettings = {
          currency: 'NGN',
          taxRate: 20,
          insuranceRate: 10,
          pensionRate: 5,
          bonusStructure: {
            productivity: { enabled: true, tiers: [] },
            attendance: { enabled: true, tiers: [] },
            overtime: { enabled: true, rate: 1.5, maxHours: 40 }
          },
          deductions: {
            tax: { enabled: true, rate: 20, minThreshold: 0 },
            insurance: { enabled: true, rate: 10, types: [] },
            pension: { enabled: true, rate: 5, employerMatch: 3 },
            other: { enabled: false, items: [] }
          }
        }
      }

      // Debug: Log employee payment details before validation
      console.log('Payment validation - employee details:', {
        mobileNumber: employee.mobileNumber,
        bankAccount: employee.bankAccount,
        currency: payrollSettings.currency
      });

      // Validate payment instrument based on currency
      if (payrollSettings.currency === 'GHS') {
        if (!employee.mobileNumber && !employee.bankAccount?.accountNumber) {
          throw new Error('For GHS payouts, provide either a 10-digit mobile money number or bank account details.')
        }
      } else if (payrollSettings.currency === 'NGN') {
        // For Nigeria, require bank transfer
        if (!employee.bankAccount?.accountNumber || !employee.bankAccount?.bankCode) {
          throw new Error('For NGN payouts, a bank account (account number and bank code) is required.')
        }
      } else {
        // For other currencies, require either mobile or bank
        if (!employee.mobileNumber && !employee.bankAccount?.accountNumber) {
          throw new Error('Provide a mobile wallet number or bank account for this currency.')
        }
      }

      // Upsert payroll entry before initiating payment (ensures a record exists for reconciliation)
      try {
        const currentPeriod = getBiweeklyPeriodForDate(new Date())

        await fetch('/api/payroll/entries', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeeId: employee.id,
            periodStartDate: periodStartDateString(currentPeriod),
            periodEndDate: periodEndDateString(currentPeriod),
            basicSalary: calculation.baseSalary,
            grossSalary: calculation.summary.grossSalary,
            netSalary: calculation.summary.netSalary,
            notes,
            status: 'pending',
          }),
        })
      } catch (prepErr) {
        console.warn('Failed to upsert pre-payment payroll entry:', prepErr)
      }

      // Build payment item with priority logic
      const payrollItem: GenericPayrollItem = {
        employeeId: employee.id,
        employeeName: employee.name,
        netSalary: calculation.summary.netSalary,
        currency: payrollSettings.currency,
        ...(payrollSettings.currency === 'GHS' && employee.mobileNumber
          ? { mobileNumber: employee.mobileNumber.replace(/\D/g, '').slice(0, 10) }
          : employee.bankAccount?.accountNumber && employee.bankAccount?.bankCode
          ? { bankAccount: {
              accountNumber: employee.bankAccount.accountNumber,
              bankCode: employee.bankAccount.bankCode,
              accountName: employee.bankAccount.accountName || employee.name
            } }
          : employee.mobileNumber
          ? { mobileNumber: employee.mobileNumber.replace(/\D/g, '').slice(0, 10) }
          : { mobileNumber: '' })
      }

      console.log('Processing payment for:', payrollItem)

      const response = await fetch('/api/payroll/paystack', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([payrollItem])
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Payment API error:', errorText)
        throw new Error(`Payment API error: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      console.log('Payment result:', result)
      
      if (result.error) {
        throw new Error(result.error)
      }
      
      setPaymentResult(result)
      // Success or pending statuses will be reconciled by webhook/status polling
    } catch (err) {
      console.error('Payment error:', err)
      setError(err instanceof Error ? err.message : 'Failed to process payment. Please try again.')
    } finally {
      setPaymentProcessing(false)
    }
  }

  // Initialize productivity service
  useEffect(() => {
    const initializeProductivityService = async () => {
      try {
        const settings = await settingsClientService.getSettings()
        const productivitySettings = settings.productivity
        
        // Create a proper ProductivitySettings object with defaults
        const defaultProductivitySettings = {
          trackingEnabled: productivitySettings.trackingEnabled || true,
          idleThreshold: productivitySettings.idleThreshold || 5,
          syncInterval: 30,
          collectUrls: true,
          collectTitles: true,
          retentionPeriod: 30,
          productiveDomains: productivitySettings.productiveDomains || [],
          productiveSites: [],
          unproductiveSites: productivitySettings.unproductiveSites || [],
          workingHours: {
            start: "09:00",
            end: "17:00"
          },
          breakDuration: 15,
          targetProductiveHours: productivitySettings.targetProductiveHours || 6,
          focusSessionDuration: productivitySettings.focusSessionDuration || 25,
          maxFocusSessionsPerDay: 8,
          minFocusTimePercentage: 60,
          maxMeetingTimePercentage: 30,
          productivityThresholds: {
            low: 40,
            medium: 70,
            high: 90
          },
          notificationPreferences: {
            focusReminders: true,
            breakReminders: true,
            productivityAlerts: true,
            meetingReminders: true
          }
        }
        
        setProductivityService(ProductivityService.getInstance(defaultProductivitySettings, defaultProductivitySettings))
      } catch (error) {
        console.error('Failed to initialize productivity service:', error)
      }
    }

    initializeProductivityService()
  }, [])

  // Auto-calculate when base salary changes
  useEffect(() => {
    if (baseSalary > 0) {
      const timeoutId = setTimeout(() => {
        calculatePayroll()
      }, 500) // Debounce for 500ms

      return () => clearTimeout(timeoutId)
    }
  }, [baseSalary])

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Process Payroll for {employee.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
              {error}
            </div>
          )}

          {/* Base Salary Input */}
          <div>
            <Label htmlFor="baseSalary" className="text-base font-medium">
              Base Salary <span className="text-red-500">*</span>
            </Label>
            <Input
              id="baseSalary"
              type="number"
              value={baseSalary}
              onChange={e => setBaseSalary(Number(e.target.value))}
              placeholder="Enter base salary"
              required
              className="mt-1"
            />
          </div>

          {calculating && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-sm text-gray-600">Calculating payroll...</span>
            </div>
          )}

          {calculation && (
            <div className="space-y-6">
              {/* Productivity Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp className="h-5 w-5" />
                    Productivity Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Productivity Score</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={calculation.productivity.score >= 80 ? 'default' : 'secondary'}>
                          {calculation.productivity.score.toFixed(1)}%
                        </Badge>
                        <span className="text-sm text-gray-600">{calculation.productivity.description}</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Performance Bonus</Label>
                      <div className="text-lg font-semibold text-green-600 mt-1">
                        {formatCurrency(calculation.productivity.bonus)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Attendance Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Calendar className="h-5 w-5" />
                    Attendance Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Attendance Rate</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={calculation.attendance.rate >= 95 ? 'default' : 'secondary'}>
                          {calculation.attendance.rate.toFixed(1)}%
                        </Badge>
                        <span className="text-sm text-gray-600">{calculation.attendance.description}</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Attendance Bonus</Label>
                      <div className="text-lg font-semibold text-green-600 mt-1">
                        {formatCurrency(calculation.attendance.bonus)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Overtime */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock className="h-5 w-5" />
                    Overtime
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Hours Worked</Label>
                      <div className="text-lg font-semibold mt-1">
                        {calculation.overtime.hours.toFixed(1)}h
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Rate</Label>
                      <div className="text-lg font-semibold mt-1">
                        {calculation.overtime.rate}x
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Overtime Pay</Label>
                      <div className="text-lg font-semibold text-green-600 mt-1">
                        {formatCurrency(calculation.overtime.pay)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Deductions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <DollarSign className="h-5 w-5" />
                    Deductions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Tax</Label>
                      <div className="text-lg font-semibold text-red-600 mt-1">
                        {formatCurrency(calculation.deductions.tax)}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Insurance</Label>
                      <div className="text-lg font-semibold text-red-600 mt-1">
                        {formatCurrency(calculation.deductions.insurance)}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Pension</Label>
                      <div className="text-lg font-semibold text-red-600 mt-1">
                        {formatCurrency(calculation.deductions.pension)}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Other</Label>
                      <div className="text-lg font-semibold text-red-600 mt-1">
                        {formatCurrency(calculation.deductions.other)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Summary */}
              <Card className="bg-gray-50">
                <CardHeader>
                  <CardTitle className="text-lg">Payroll Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Base Salary</span>
                      <span className="font-semibold">{formatCurrency(calculation.baseSalary)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Total Bonuses</span>
                      <span className="font-semibold text-green-600">
                        +{formatCurrency(calculation.productivity.bonus + calculation.attendance.bonus + calculation.overtime.pay)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Gross Salary</span>
                      <span className="font-semibold">{formatCurrency(calculation.summary.grossSalary)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Total Deductions</span>
                      <span className="font-semibold text-red-600">
                        -{formatCurrency(calculation.summary.totalDeductions)}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold">Net Salary</span>
                      <span className="text-xl font-bold text-primary">
                        {formatCurrency(calculation.summary.netSalary)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Notes */}
              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Input
                  id="notes"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Add any additional notes..."
                  className="mt-1"
                />
              </div>

              {/* Payment Result */}
              {paymentResult && (
                <Card className="bg-green-50 border-green-200">
                  <CardHeader>
                    <CardTitle className="text-green-800">Payment Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-green-700">
                      <p><strong>Total Processed:</strong> {paymentResult.total}</p>
                      <p><strong>Successful:</strong> {paymentResult.successful}</p>
                      <p><strong>Failed:</strong> {paymentResult.failed}</p>
                      {paymentResult.pending && <p><strong>Pending:</strong> {paymentResult.pending}</p>}
                      {paymentResult.results.map((result: any, index: number) => (
                        <div key={index} className="mt-2 p-2 bg-white rounded">
                          <p><strong>Employee:</strong> {result.employeeId}</p>
                          <p><strong>Status:</strong> <span className={`font-semibold ${result.status === 'success' ? 'text-green-600' : result.status === 'error' ? 'text-red-600' : 'text-yellow-600'}`}>{result.status}</span></p>
                          <p><strong>Provider:</strong> {result.provider?.charAt(0).toUpperCase() + result.provider?.slice(1)}</p>
                          {result.transactionId && <p><strong>Transaction ID:</strong> {result.transactionId}</p>}
                          {result.reference && <p><strong>Reference:</strong> {result.reference}</p>}
                          {result.error && <p className="text-red-600"><strong>Error:</strong> {result.error}</p>}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <div className="flex justify-end gap-4">
            <Button 
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading || paymentProcessing}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || paymentProcessing || !calculation}
              className="bg-primary hover:bg-primary/90"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Payroll
            </Button>
            {calculation && !paymentResult && (
              <Button 
                type="button"
                onClick={handlePaymentProcessing}
                disabled={loading || paymentProcessing || !calculation}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {paymentProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Process Payment
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
} 