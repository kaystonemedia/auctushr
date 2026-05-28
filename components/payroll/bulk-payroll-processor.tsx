'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { formatCurrency } from '@/lib/utils'
import { Loader2, Users, DollarSign, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react'
import { settingsClientService } from '@/lib/settings-client'
import { GenericPayrollItem } from '@/lib/generic-payment-service'

interface Employee {
  id: string
  firstName: string
  lastName: string
  department?: string
  salary?: number
  mobileNumber?: string
  bankAccount?: {
    accountNumber: string
    bankCode: string
    accountName?: string
  }
}

interface BulkPayrollProcessorProps {
  onSuccess: () => void
  onCancel: () => void
}

interface ProcessingResult {
  employeeId: string
  employeeName: string
  status: 'success' | 'error' | 'pending'
  amount: number
  error?: string
  transactionId?: string
  reference?: string
}

export function BulkPayrollProcessor({ onSuccess, onCancel }: BulkPayrollProcessorProps) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<ProcessingResult[]>([])
  const [payrollSettings, setPayrollSettings] = useState<any>(null)
  const [employeeSalaries, setEmployeeSalaries] = useState<Record<string, number>>({})

  // Load employees and settings
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        
        // Load payroll settings
        const settings = await settingsClientService.getSettings()
        setPayrollSettings(settings.payroll)

        const empRes = await fetch('/api/employees', { credentials: 'include' })
        if (!empRes.ok) throw new Error('Failed to load employees')
        const empData = await empRes.json()
        setEmployees(
          (empData.employees || []).map(
            (e: {
              id: string
              firstName: string
              lastName: string
              email: string
              department: string
              salary: number
              mobileNumber?: string
              bankAccount?: Employee['bankAccount']
            }) => ({
              id: e.id,
              firstName: e.firstName || '',
              lastName: e.lastName || '',
              email: e.email || '',
              department: e.department || '',
              salary: e.salary || 0,
              mobileNumber: e.mobileNumber || '',
              bankAccount: e.bankAccount || null,
            })
          )
        )
      } catch (err) {
        console.error('Error loading data:', err)
        setError('Failed to load employee data. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleEmployeeSelection = (employeeId: string, checked: boolean) => {
    const newSelection = new Set(selectedEmployees)
    if (checked) {
      newSelection.add(employeeId)
    } else {
      newSelection.delete(employeeId)
    }
    setSelectedEmployees(newSelection)
  }

  const handleSelectAll = () => {
    if (selectedEmployees.size === employees.length) {
      setSelectedEmployees(new Set())
    } else {
      setSelectedEmployees(new Set(employees.map(emp => emp.id)))
    }
  }

  const calculateNetSalary = (employee: Employee): number => {
    // Use manually set salary if available, otherwise use employee's salary
    const baseSalary = employeeSalaries[employee.id] || employee.salary || 0
    const deductions = payrollSettings?.deductions || { tax: { rate: 20 }, insurance: { rate: 10 }, pension: { rate: 5 } }
    
    const tax = (baseSalary * deductions.tax.rate) / 100
    const insurance = (baseSalary * deductions.insurance.rate) / 100
    const pension = (baseSalary * deductions.pension.rate) / 100
    
    return baseSalary - tax - insurance - pension
  }

  const processBulkPayroll = async () => {
    if (selectedEmployees.size === 0) {
      setError('Please select at least one employee to process payroll.')
      return
    }

    setProcessing(true)
    setError(null)
    setResults([])

    try {
      const selectedEmployeeData = employees.filter(emp => selectedEmployees.has(emp.id))
      
      // Validate selected employees - check for various field names and salary
      console.log('=== VALIDATION DEBUG ===')
      console.log('Selected employees:', selectedEmployeeData.map(emp => ({
        name: `${emp.firstName} ${emp.lastName}`,
        id: emp.id,
        salary: emp.salary,
        allFields: Object.keys(emp)
      })))
      
      const invalidEmployees = selectedEmployeeData.filter(emp => {
        const hasMobileNumber = emp.mobileNumber || emp.mobile_number || emp.phoneNumber || emp.phone_number
        const hasBankAccount = emp.bankAccount || emp.bank_account
        const hasValidSalary = (employeeSalaries[emp.id] && employeeSalaries[emp.id] > 0) || (emp.salary && emp.salary > 0)
        
        console.log(`Checking ${emp.firstName} ${emp.lastName}:`, {
          mobileNumber: emp.mobileNumber,
          mobile_number: emp.mobile_number,
          phoneNumber: emp.phoneNumber,
          phone_number: emp.phone_number,
          bankAccount: emp.bankAccount,
          bank_account: emp.bank_account,
          salary: emp.salary,
          manualSalary: employeeSalaries[emp.id],
          finalSalary: employeeSalaries[emp.id] || emp.salary,
          hasMobileNumber,
          hasBankAccount,
          hasValidSalary,
          isValid: !!(hasMobileNumber || hasBankAccount) && hasValidSalary
        })
        
        return (!hasMobileNumber && !hasBankAccount) || !hasValidSalary
      })
      
      console.log('Invalid employees:', invalidEmployees.map(emp => `${emp.firstName} ${emp.lastName}`))
      console.log('=== END VALIDATION DEBUG ===')

      if (invalidEmployees.length > 0) {
        const invalidNames = invalidEmployees.map(e => `${e.firstName} ${e.lastName}`).join(', ')
        setError(`The following employees are missing payment details or have invalid salaries: ${invalidNames}. Please add mobile numbers/bank account details and ensure salaries are set for these employees before processing bulk payroll.`)
        setProcessing(false)
        return
      }

      console.log('All selected employees have payment details:', selectedEmployeeData.map(emp => ({
        name: `${emp.firstName} ${emp.lastName}`,
        mobileNumber: emp.mobileNumber,
        bankAccount: emp.bankAccount
      })))

      // Build payroll items
      const payrollItems: GenericPayrollItem[] = selectedEmployeeData.map(employee => {
        // Get mobile number from various possible field names
        const mobileNumber = employee.mobileNumber || employee.mobile_number || employee.phoneNumber || employee.phone_number
        const bankAccount = employee.bankAccount || employee.bank_account
        
        return {
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          netSalary: calculateNetSalary(employee),
          currency: payrollSettings?.currency || 'GHS',
          ...(payrollSettings?.currency === 'GHS' && mobileNumber
            ? { mobileNumber: mobileNumber.replace(/\D/g, '').slice(0, 10) }
            : bankAccount?.accountNumber && bankAccount?.bankCode
            ? { bankAccount: {
                accountNumber: bankAccount.accountNumber,
                bankCode: bankAccount.bankCode,
                accountName: bankAccount.accountName || `${employee.firstName} ${employee.lastName}`
              } }
            : mobileNumber
            ? { mobileNumber: mobileNumber.replace(/\D/g, '').slice(0, 10) }
            : { mobileNumber: '' })
        }
      })

      console.log('Processing bulk payroll for:', payrollItems.length, 'employees')

      // Call payment API
      const response = await fetch('/api/payroll/paystack', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payrollItems)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Payment API error: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      console.log('Bulk payment result:', result)

      if (result.error) {
        throw new Error(result.error)
      }

      // Process results
      const processingResults: ProcessingResult[] = result.results.map((res: any) => ({
        employeeId: res.employeeId,
        employeeName: selectedEmployeeData.find(e => e.id === res.employeeId)?.firstName + ' ' + selectedEmployeeData.find(e => e.id === res.employeeId)?.lastName || 'Unknown',
        status: res.status,
        amount: selectedEmployeeData.find(e => e.id === res.employeeId)?.salary || 0,
        error: res.error,
        transactionId: res.transactionId,
        reference: res.reference
      }))

      setResults(processingResults)

      const now = new Date()
      const periodMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

      for (const res of processingResults) {
        if (res.status !== 'success') continue
        const employee = selectedEmployeeData.find((e) => e.id === res.employeeId)
        if (!employee) continue
        const gross = employee.salary || 0
        await fetch('/api/payroll/entries', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeeId: res.employeeId,
            periodMonth,
            basicSalary: gross,
            grossSalary: gross,
            netSalary: res.amount,
            deductions: [
              {
                type: 'tax',
                name: 'Tax',
                amount: (gross * (payrollSettings?.deductions?.tax?.rate || 20)) / 100,
              },
            ],
            status: 'paid',
          }),
        })
      }

    } catch (err) {
      console.error('Bulk payroll error:', err)
      setError(err instanceof Error ? err.message : 'Failed to process bulk payroll. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-100 text-green-800">Success</Badge>
      case 'error':
        return <Badge variant="destructive">Error</Badge>
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Loading employees...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Bulk Payroll Processing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all"
                checked={selectedEmployees.size === employees.length}
                onCheckedChange={handleSelectAll}
              />
              <label htmlFor="select-all" className="text-sm font-medium">
                Select All ({employees.length} employees)
              </label>
            </div>
            <div className="text-sm text-gray-600">
              {selectedEmployees.size} selected
            </div>
          </div>

          <Separator />

          {/* Missing Payment Details Alert */}
          {employees.some(emp => !emp.mobileNumber && !emp.bankAccount) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <div className="text-yellow-600">⚠️</div>
                <div>
                  <h4 className="font-medium text-yellow-800">Missing Payment Details</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Some employees don't have mobile money numbers or bank accounts. 
                    They were created with an old onboarding module that didn't include payment fields.
                  </p>
                  <div className="mt-2 text-xs text-yellow-600">
                    <strong>Missing payment details:</strong>{' '}
                    {employees
                      .filter(emp => !emp.mobileNumber && !emp.bankAccount)
                      .map(emp => `${emp.firstName} ${emp.lastName}`)
                      .join(', ')}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="max-h-96 overflow-y-auto space-y-2">
            {employees.map(employee => {
              const hasPaymentDetails = employee.mobileNumber || employee.bankAccount
              return (
              <div key={employee.id} className={`flex items-center justify-between p-3 border rounded-lg ${!hasPaymentDetails ? 'bg-red-50 border-red-200' : ''}`}>
                <div className="flex items-center gap-3">
                  <Checkbox
                    id={employee.id}
                    checked={selectedEmployees.has(employee.id)}
                    onCheckedChange={(checked) => handleEmployeeSelection(employee.id, checked as boolean)}
                  />
                  <div>
                    <div className="font-medium">{employee.firstName} {employee.lastName}</div>
                    <div className="text-sm text-gray-600">
                      {employee.department || 'Unassigned'} • {formatCurrency(employee.salary || 0)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {(() => {
                        const mobileNumber = employee.mobileNumber || employee.mobile_number || employee.phoneNumber || employee.phone_number
                        const bankAccount = employee.bankAccount || employee.bank_account
                        
                        if (mobileNumber) return `Mobile: ${mobileNumber}`
                        if (bankAccount?.accountNumber) return `Bank: ${bankAccount.accountNumber}`
                        return '❌ No payment details - Update employee profile'
                      })()}
                    </div>
                  </div>
                </div>
                <div className="text-right space-y-2">
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500">Base Salary</label>
                    <input
                      type="number"
                      value={employeeSalaries[employee.id] || employee.salary || ''}
                      onChange={(e) => setEmployeeSalaries(prev => ({
                        ...prev,
                        [employee.id]: parseFloat(e.target.value) || 0
                      }))}
                      className="w-24 px-2 py-1 text-sm border rounded"
                      placeholder="0"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="font-medium">{formatCurrency(calculateNetSalary(employee))}</div>
                  <div className="text-xs text-gray-500">Net Salary</div>
                </div>
              </div>
              )
            })}
          </div>

          <div className="flex gap-3">
            <Button
              onClick={processBulkPayroll}
              disabled={processing || selectedEmployees.size === 0}
              className="flex-1"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <DollarSign className="h-4 w-4 mr-2" />
                  Process Payroll ({selectedEmployees.size} employees)
                </>
              )}
            </Button>
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Processing Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {results.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(result.status)}
                    <div>
                      <div className="font-medium">{result.employeeName}</div>
                      {result.error && (
                        <div className="text-sm text-red-600">{result.error}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-medium">{formatCurrency(result.amount)}</div>
                      <div className="text-xs text-gray-500">
                        {result.transactionId ? `TXN: ${result.transactionId.slice(0, 8)}...` : ''}
                      </div>
                    </div>
                    {getStatusBadge(result.status)}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-3">
              <Button onClick={onSuccess} className="flex-1">
                Complete
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
