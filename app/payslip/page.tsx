'use client'

import { useNewAuth } from '@/contexts/new-auth-context'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Payslip } from '@/components/payroll/payslip'
import { formatPeriodLabel, getBiweeklyPeriodForDate, periodStartDateString, periodEndDateString } from '@/lib/pay-periods'

import { FileText, Download, Search, RefreshCw, CalendarRange } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface PayslipLineItem {
  type?: string
  name: string
  amount: number
}

interface PayslipEntry {
  id: string
  employeeId: string
  employeeCode?: string | null
  employeeName: string
  department: string
  position?: string
  ssnitNumber?: string | null
  bankAccount?: {
    accountNumber?: string
    bankName?: string
    branch?: string
    accountName?: string
  } | null
  baseSalary: number
  performanceBonus: number
  attendanceBonus: number
  overtimeHours?: number
  overtimeRate?: number
  overtimeAmount?: number
  totalBonus: number
  grossSalary: number
  allowances?: PayslipLineItem[]
  deductions: PayslipLineItem[]
  netPay: number
  payFrequency?: string
  periodStartDate?: string | null
  periodEndDate?: string | null
  daysWorked?: number | null
  daysAbsent?: number | null
  currency?: string
  exchangeRate?: number | null
  paymentDate?: string | null
  month: string
  year: number
  processedAt: string
}

export default function PayslipPage() {
  const { user } = useNewAuth()
  const [payslips, setPayslips] = useState<PayslipEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [selectedYear, setSelectedYear] = useState('')
  const [showPayslip, setShowPayslip] = useState(false)
  const [selectedPayslip, setSelectedPayslip] = useState<PayslipEntry | null>(null)
  const [selectedPayslipType, setSelectedPayslipType] = useState<'biweekly' | 'annual'>('biweekly')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (user?.id) {
      fetchPayslips()
    }
  }, [user])

  const fetchPayslips = async () => {
    try {
      setLoading(true)

      // Use the working API endpoint with user ID for specific employee payslips
      // If user is admin/manager, don't pass employeeId to get all payslips
      let url = '/api/payroll/payslip-working'
      if (user?.role === 'employee') {
        url += `?employeeId=${user.id}`
      }

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('Failed to fetch payslips')
      }

      const data = await response.json()

      if (data.success) {
        const list = Array.isArray(data.payslips)
          ? data.payslips
          : data.payslip
          ? [data.payslip]
          : []
        setPayslips(list)
      } else {
        setPayslips([])
      }
    } catch (error) {
      console.error('Error fetching payslips:', error)
      toast.error('Failed to fetch payslips')
      setPayslips([])
    } finally {
      setLoading(false)
    }
  }

  const handleViewPayslip = async (payslip: PayslipEntry) => {
    try {
      setRefreshing(true)

      const params = new URLSearchParams({ employeeId: payslip.employeeId })
      if (payslip.periodStartDate) params.set('periodStart', payslip.periodStartDate)
      if (payslip.periodEndDate) params.set('periodEnd', payslip.periodEndDate)

      const response = await fetch(`/api/payroll/payslip-working?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to fetch payslip data')
      }

      const data = await response.json()
      if (data.success) {
        const detailedPayslip =
          data.payslip ||
          (Array.isArray(data.payslips) && data.payslips.length > 0 ? data.payslips[0] : null)

        if (!detailedPayslip) {
          setSelectedPayslip(payslip)
          setSelectedPayslipType('biweekly')
          setShowPayslip(true)
          return
        }

        setSelectedPayslip(detailedPayslip)
        setSelectedPayslipType('biweekly')
        setShowPayslip(true)
      } else {
        throw new Error(data.error || 'Failed to fetch payslip data')
      }
    } catch (error) {
      console.error('Error fetching payslip data:', error)
      toast.error('Failed to load payslip data')
      setSelectedPayslip(payslip)
      setSelectedPayslipType('biweekly')
      setShowPayslip(true)
    } finally {
      setRefreshing(false)
    }
  }

  const handleViewYearlyPayslip = async (payslip: PayslipEntry) => {
    try {
      setRefreshing(true)
      const params = new URLSearchParams({
        employeeId: payslip.employeeId,
        year: String(payslip.year),
        frequency: 'annual'
      })
      const response = await fetch(`/api/payroll/payslip-working?${params.toString()}`)
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load yearly payslip')
      }

      setSelectedPayslip(data.payslip)
      setSelectedPayslipType('annual')
      setShowPayslip(true)
    } catch (error) {
      console.error('Error fetching yearly payslip:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to load yearly payslip')
    } finally {
      setRefreshing(false)
    }
  }

  const handleGeneratePayslip = async (employeeId: string, periodStartDate: string, periodEndDate: string) => {
    try {
      setRefreshing(true)

      const response = await fetch('/api/payroll/payslip-working', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId,
          periodStart: periodStartDate,
          periodEnd: periodEndDate
        })
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMsg = data.details || data.error || `HTTP ${response.status}: Failed to generate payslip`
        throw new Error(errorMsg)
      }

      if (data.success && data.payslip) {
        setSelectedPayslip(data.payslip)
        setSelectedPayslipType('biweekly')
        setShowPayslip(true)
        toast.success('Payslip generated successfully')
        await fetchPayslips()
      } else {
        throw new Error(data.error || data.details || 'Failed to generate payslip')
      }
    } catch (error) {
      console.error('Error generating payslip:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate payslip'
      toast.error(`Payslip generation failed: ${errorMessage}`)
    } finally {
      setRefreshing(false)
    }
  }

  const periodKey = (p: PayslipEntry) =>
    p.periodStartDate && p.periodEndDate ? `${p.periodStartDate}_${p.periodEndDate}` : `${p.month}/${p.year}`

  const periodDisplayLabel = (p: PayslipEntry) =>
    p.periodStartDate && p.periodEndDate ? formatPeriodLabel(p.periodStartDate, p.periodEndDate) : `${p.month}/${p.year}`

  const filteredPayslips = payslips.filter(payslip => {
    const search = searchQuery.toLowerCase()
    const name = (payslip.employeeName || '').toLowerCase()
    const department = (payslip.department || '').toLowerCase()
    const matchesSearch = !search || name.includes(search) || department.includes(search)
    const matchesPeriod = !selectedPeriod || selectedPeriod === 'all' || periodKey(payslip) === selectedPeriod
    const matchesYear = !selectedYear || selectedYear === 'all' || payslip.year?.toString() === selectedYear

    return matchesSearch && matchesPeriod && matchesYear
  })

  const availablePeriods = Array.from(
    new Map(payslips.map(p => [periodKey(p), { key: periodKey(p), label: periodDisplayLabel(p) }])).values()
  ).sort((a, b) => b.key.localeCompare(a.key))

  const availableYears = [...new Set(payslips.map(p => p.year).filter(year => year && !isNaN(year)))].sort((a, b) => b - a)

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Access Denied</h1>
          <p className="mt-2 text-gray-600">Please sign in to view payslips.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Payslips</h1>
          <p className="text-gray-500">
            {user.role === 'admin' ? 'View all employee payslips' :
             user.role === 'manager' ? 'View team payslips' :
             'View your payslips'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={fetchPayslips}
            disabled={loading}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {user.role === 'admin' && (
            <Button
              onClick={async () => {
                const period = getBiweeklyPeriodForDate(new Date())
                await handleGeneratePayslip(user.id, periodStartDateString(period), periodEndDateString(period))
              }}
              variant="outline"
              size="sm"
            >
              Generate My Payslip
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by name or department..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Pay Period</label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="All periods" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All periods</SelectItem>
                  {availablePeriods.map(period => (
                    <SelectItem key={period.key} value={period.key}>
                      {period.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue placeholder="All years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All years</SelectItem>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payslips List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Payslips ({filteredPayslips.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2">Loading payslips...</span>
            </div>
          ) : filteredPayslips.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No payslips found</p>
              <p className="text-sm">Payslips will appear here once payroll is processed</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPayslips.map((payslip) => (
                <div
                  key={payslip.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-primary/10 rounded-full">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {payslip.employeeName}
                        {payslip.employeeCode && (
                          <span className="ml-2 text-xs text-gray-400">{payslip.employeeCode}</span>
                        )}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {payslip.department} • {periodDisplayLabel(payslip)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="font-medium text-gray-900">
                        {payslip.netPay?.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                      </p>
                      <p className="text-sm text-gray-500">Net Pay</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewPayslip(payslip)}
                        disabled={refreshing}
                        className="flex items-center space-x-2"
                      >
                        <Download className="h-4 w-4" />
                        <span>View</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewYearlyPayslip(payslip)}
                        disabled={refreshing}
                        className="flex items-center space-x-2"
                      >
                        <CalendarRange className="h-4 w-4" />
                        <span>Yearly</span>
                      </Button>
                      {user.role === 'admin' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (!payslip.periodStartDate || !payslip.periodEndDate) {
                              toast.error('This entry has no biweekly period to regenerate')
                              return
                            }
                            handleGeneratePayslip(payslip.employeeId, payslip.periodStartDate, payslip.periodEndDate)
                          }}
                          disabled={refreshing}
                          className="flex items-center space-x-2"
                        >
                          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                          <span>Regenerate</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payslip Dialog */}
      <Dialog open={showPayslip} onOpenChange={setShowPayslip}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedPayslipType === 'annual' ? 'Annual Payslip' : 'Employee Payslip'}</DialogTitle>
          </DialogHeader>
          {selectedPayslip && (
            <Payslip
              payslipType={selectedPayslipType}
              payroll={{
                employeeCode: selectedPayslip.employeeCode,
                employeeName: selectedPayslip.employeeName,
                department: selectedPayslip.department,
                position: selectedPayslip.position,
                ssnitNumber: selectedPayslip.ssnitNumber,
                bankAccount: selectedPayslip.bankAccount,
                baseSalary: selectedPayslip.baseSalary,
                performanceBonus: selectedPayslip.performanceBonus,
                attendanceBonus: selectedPayslip.attendanceBonus,
                overtimeHours: selectedPayslip.overtimeHours,
                overtimeRate: selectedPayslip.overtimeRate,
                overtimeAmount: selectedPayslip.overtimeAmount,
                totalBonus: selectedPayslip.totalBonus,
                grossSalary: selectedPayslip.grossSalary,
                allowances: selectedPayslip.allowances,
                deductions: selectedPayslip.deductions,
                netPay: selectedPayslip.netPay,
                payFrequency: selectedPayslip.payFrequency,
                periodStartDate: selectedPayslip.periodStartDate,
                periodEndDate: selectedPayslip.periodEndDate,
                daysWorked: selectedPayslip.daysWorked,
                daysAbsent: selectedPayslip.daysAbsent,
                currency: selectedPayslip.currency,
                exchangeRate: selectedPayslip.exchangeRate,
                paymentDate: selectedPayslip.paymentDate,
                month: selectedPayslip.month,
                year: selectedPayslip.year,
                processedAt: selectedPayslip.processedAt,
              }}
              onClose={() => setShowPayslip(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
