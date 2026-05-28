'use client'

import { useNewAuth } from '@/contexts/new-auth-context'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Payslip } from '@/components/payroll/payslip'

import { format } from 'date-fns'
import { FileText, Download, Search, RefreshCw } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface PayslipEntry {
  id: string
  employeeId: string
  employeeName: string
  department: string
  baseSalary: number
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
  processedAt: string
  productivityScore?: number
  attendanceRate?: number
  focusTimePercentage?: number
  taskCompletionRate?: number
  totalFocusSessions?: number
  totalTasksCompleted?: number
  totalMeetingHours?: number
}

export default function PayslipPage() {
  const { user } = useNewAuth()
  const [payslips, setPayslips] = useState<PayslipEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [selectedYear, setSelectedYear] = useState('')
  const [showPayslip, setShowPayslip] = useState(false)
  const [selectedPayslip, setSelectedPayslip] = useState<PayslipEntry | null>(null)
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
        console.log('Payslips fetched from API:', list)
        setPayslips(list)
      } else {
        console.log('No payslips found or API returned error:', data)
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
      
      // Fetch enhanced payslip data from API
      const response = await fetch(`/api/payroll/payslip-working?employeeId=${payslip.employeeId}&month=${payslip.month}&year=${payslip.year}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch payslip data')
      }
      
      const data = await response.json()
      if (data.success) {
        const detailedPayslip =
          data.payslip ||
          (Array.isArray(data.payslips) && data.payslips.length > 0 ? data.payslips[0] : null)

        if (!detailedPayslip) {
          console.warn('Payslip API responded without payslip data, falling back to basic payslip.', data)
          // Fall back to the basic payslip that was already loaded in the list
          setSelectedPayslip(payslip)
          setShowPayslip(true)
          return
        }

        setSelectedPayslip(detailedPayslip)
        setShowPayslip(true)
      } else {
        throw new Error(data.error || 'Failed to fetch payslip data')
      }
    } catch (error) {
      console.error('Error fetching payslip data:', error)
      toast.error('Failed to load payslip data')
      // Fallback to basic payslip data
      setSelectedPayslip(payslip)
      setShowPayslip(true)
    } finally {
      setRefreshing(false)
    }
  }

     const handleGeneratePayslip = async (employeeId: string, month: string, year: number) => {
     try {
       setRefreshing(true)
       
       // Validate parameters before sending
       if (!employeeId || !month || !year) {
         throw new Error(`Missing parameters: employeeId=${employeeId}, month=${month}, year=${year}`)
       }
       
       console.log('Generating payslip with:', { employeeId, month, year })
       
       const response = await fetch('/api/payroll/payslip-working', {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
         },
         body: JSON.stringify({
           employeeId,
           month,
           year
         })
       })
      
      const data = await response.json()
      
             if (!response.ok) {
         console.error('API Error Response:', data)
         const errorMsg = data.details || data.error || `HTTP ${response.status}: Failed to generate payslip`
         throw new Error(errorMsg)
       }
      
      if (data.success && data.payslip) {
        setSelectedPayslip(data.payslip)
        setShowPayslip(true)
        toast.success('Payslip generated successfully')
        // Refresh the payslips list
        await fetchPayslips()
      } else {
        throw new Error(data.error || data.details || 'Failed to generate payslip')
      }
         } catch (error) {
       console.error('Error generating payslip:', error)
       console.error('Error details:', {
         message: error instanceof Error ? error.message : 'Unknown error',
         stack: error instanceof Error ? error.stack : undefined,
         employeeId,
         month,
         year
       })
       const errorMessage = error instanceof Error ? error.message : 'Failed to generate payslip'
       toast.error(`Payslip generation failed: ${errorMessage}`)
     } finally {
      setRefreshing(false)
    }
  }

  const filteredPayslips = payslips.filter(payslip => {
    const search = searchQuery.toLowerCase()
    const name = (payslip.employeeName || '').toLowerCase()
    const department = (payslip.department || '').toLowerCase()
    const matchesSearch = !search || name.includes(search) || department.includes(search)
    const matchesMonth = !selectedMonth || selectedMonth === 'all' || payslip.month === selectedMonth
    const matchesYear = !selectedYear || selectedYear === 'all' || payslip.year?.toString() === selectedYear

    return matchesSearch && matchesMonth && matchesYear
  })

  const availableMonths = [...new Set(payslips.map(p => p.month).filter(month => month && month !== ''))].sort()
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
             <>
              <Button
                onClick={async () => {
                  try {
                    const currentDate = new Date()
                    const currentMonth = (currentDate.getMonth() + 1).toString()
                    const currentYear = currentDate.getFullYear()
                    
                    console.log('Generating payslip for current period:', { 
                      employeeId: user.id, 
                      month: currentMonth, 
                      year: currentYear 
                    })
                    
                    await handleGeneratePayslip(user.id, currentMonth, currentYear)
                    toast.success('Payslip generated successfully')
                    await fetchPayslips()
                  } catch (error) {
                    console.error('Error generating payslip:', error)
                    toast.error('Failed to generate payslip')
                  }
                }}
                variant="outline"
                size="sm"
              >
                Generate My Payslip
              </Button>
            </>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="All months" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All months</SelectItem>
                  {availableMonths.map(month => (
                    <SelectItem key={month} value={month}>
                      {(() => {
                        try {
                          return format(new Date(2024, parseInt(month) - 1), 'MMMM')
                        } catch {
                          return `Month ${month}`
                        }
                      })()}
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
                      </h3>
                      <p className="text-sm text-gray-500">
                        {payslip.department} • {payslip.processedAt ? format(new Date(payslip.processedAt), 'MMMM yyyy') : `${payslip.month}/${payslip.year}`}
                      </p>
                      {payslip.productivityScore && (
                        <p className="text-xs text-green-600">
                          Productivity: {payslip.productivityScore.toFixed(1)}%
                        </p>
                      )}
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
                                             {user.role === 'admin' && (
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={() => {
                             // Use current month/year if the payslip data is missing these values
                             const currentDate = new Date()
                             const month = payslip.month || (currentDate.getMonth() + 1).toString()
                             const year = payslip.year || currentDate.getFullYear()
                             
                             console.log('Regenerating payslip with:', { 
                               employeeId: payslip.employeeId, 
                               month, 
                               year,
                               originalMonth: payslip.month,
                               originalYear: payslip.year
                             })
                             
                             handleGeneratePayslip(payslip.employeeId, month, year)
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
            <DialogTitle>Employee Payslip</DialogTitle>
          </DialogHeader>
          {selectedPayslip && (
            <Payslip 
              payroll={{
                employeeName: selectedPayslip.employeeName,
                department: selectedPayslip.department,
                baseSalary: selectedPayslip.baseSalary,
                performanceBonus: selectedPayslip.performanceBonus,
                attendanceBonus: selectedPayslip.attendanceBonus,
                totalBonus: selectedPayslip.totalBonus,
                grossSalary: selectedPayslip.grossSalary,
                deductions: selectedPayslip.deductions,
                netPay: selectedPayslip.netPay,
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