'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PayrollForm } from './payroll-form'
import { PayrollSummary } from './payroll-summary'
import { PayrollEntry } from '@/types/payroll'
import { collection, query, where, getDocs, orderBy, addDoc, updateDoc, doc } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { onAuthStateChanged } from 'firebase/auth'
import { format } from 'date-fns'

// Add this before the PayrollDashboard component
const defaultReport = {
  id: 'default',
  period: new Date().toISOString(),
  description: 'Default Payroll Period',
  startDate: new Date().toISOString(),
  endDate: new Date().toISOString(),
  status: 'active',
  summary: {
    totalEmployees: 0,
    totalGrossSalary: 0,
    totalNetSalary: 0,
    totalDeductions: 0,
    totalAllowances: 0,
    byDepartment: [] as { department: string; count: number; grossSalary: number; netSalary: number }[],
    byStatus: [] as { status: string; count: number }[]
  }
}

export function PayrollDashboard() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payrollPeriods, setPayrollPeriods] = useState<PayrollEntry[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [showPayrollForm, setShowPayrollForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState<string>('')
  const [processingPayroll, setProcessingPayroll] = useState<string | null>(null)
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null)
  const [currentReport, setCurrentReport] = useState(defaultReport)

  const calculateReport = (periods: PayrollEntry[]) => {
    const currentDate = new Date().toISOString()
    return {
      id: 'generated',
      period: currentDate,
      description: `Payroll Report - ${format(new Date(), 'MMMM yyyy')}`,
      startDate: currentDate,
      endDate: currentDate,
      status: 'active',
      summary: {
        totalEmployees: employees.length,
        totalGrossSalary: periods.reduce((sum, entry) => sum + (entry.grossSalary || 0), 0),
        totalNetSalary: periods.reduce((sum, entry) => sum + (entry.netSalary || 0), 0),
        totalDeductions: periods.reduce((sum, entry) => 
          sum + (entry.deductions?.reduce((dSum, d) => dSum + (d.amount || 0), 0) || 0), 0),
        totalAllowances: periods.reduce((sum, entry) => 
          sum + (entry.allowances?.reduce((aSum, a) => aSum + (a.amount || 0), 0) || 0), 0),
        byDepartment: Object.entries(
          periods.reduce((acc, entry) => {
            const dept = entry.departmentId || 'Unassigned'
            if (!acc[dept]) {
              acc[dept] = {
                department: dept,
                count: 0,
                grossSalary: 0,
                netSalary: 0
              }
            }
            acc[dept].count++
            acc[dept].grossSalary += entry.grossSalary || 0
            acc[dept].netSalary += entry.netSalary || 0
            return acc
          }, {} as Record<string, { department: string; count: number; grossSalary: number; netSalary: number }>)
        ).map(([_, value]) => value),
        byStatus: Object.entries(
          periods.reduce((acc, entry) => {
            if (!acc[entry.status]) {
              acc[entry.status] = 0
            }
            acc[entry.status]++
            return acc
          }, {} as Record<string, number>)
        ).map(([status, count]) => ({ status, count }))
      }
    }
  }

  useEffect(() => {
    if (payrollPeriods.length > 0) {
      setCurrentReport(calculateReport(payrollPeriods))
    }
  }, [payrollPeriods, employees])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = '/auth/sign-in'
        return
      }

      try {
        // Get user data from Firestore
        const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', user.uid)))
        const userData = userDoc.docs[0]?.data()

        if (!userData?.role || userData.role !== 'admin') {
          setError('You do not have permission to access the payroll dashboard.')
          setLoading(false)
          return
        }

        setUser(userData)

        // Fetch employees
        const employeesQuery = query(collection(db, 'users'), where('role', '==', 'employee'))
        const employeesSnapshot = await getDocs(employeesQuery)
        const employeesData = employeesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setEmployees(employeesData)

        // Fetch payroll periods
        const payrollQuery = query(
          collection(db, 'payroll'),
          orderBy('period', 'desc')
        )
        const payrollSnapshot = await getDocs(payrollQuery)
        const payrollData = payrollSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as PayrollEntry[]
        setPayrollPeriods(payrollData)

        setLoading(false)
      } catch (error) {
        console.error('Error fetching data:', error)
        setError('Failed to load payroll data. Please try again later.')
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  const handleProcessPayroll = async (employeeId: string) => {
    if (!selectedPeriod) {
      setError('Please select a payroll period first.')
      return
    }

    setProcessingPayroll(employeeId)
    try {
      const employee = employees.find(emp => emp.id === employeeId)
      if (!employee) {
        throw new Error('Employee not found')
      }

      // Validate required fields
      if (!employee.name) {
        throw new Error('Employee name is required')
      }

      // Calculate payroll
      const grossSalary = employee.salary || 0
      const deductions = employee.deductions || 0
      const allowances = employee.allowances || 0
      const netSalary = grossSalary - deductions + allowances

      // Add payroll entry
      const payrollEntry = {
        employeeId,
        employeeName: employee.name,
        department: employee.department || 'Unassigned',
        period: selectedPeriod,
        grossSalary,
        deductions,
        allowances,
        netSalary,
        status: 'processed',
        processedAt: new Date().toISOString(),
        processedBy: user.uid
      }

      await addDoc(collection(db, 'payrollEntries'), payrollEntry)

      // Update employee's last payroll date
      await updateDoc(doc(db, 'users', employeeId), {
        lastPayrollDate: new Date().toISOString()
      })

      // Refresh data
      window.location.reload()
    } catch (err) {
      console.error('Error processing payroll:', err)
      setError(err instanceof Error ? err.message : 'Failed to process payroll. Please try again.')
    } finally {
      setProcessingPayroll(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading payroll data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
            <Button 
              onClick={() => window.location.reload()} 
              className="mt-4"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const filteredEmployees = employees.filter(employee =>
    employee.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    employee.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getDepartmentColor = (department: string) => {
    const colors: { [key: string]: { bg: string; text: string; border: string } } = {
      'Engineering': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
      'Marketing': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
      'Sales': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
      'HR': { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
      'Finance': { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
      'Operations': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
      'default': { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' }
    }
    return colors[department] || colors.default
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Payroll Dashboard
        </h1>
        <div className="flex items-center gap-4">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select Period" />
            </SelectTrigger>
            <SelectContent>
              {payrollPeriods.map((period) => (
                <SelectItem key={period.id} value={period.id}>
                  {format(new Date(period.createdAt), 'MMMM yyyy')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={showPayrollForm} onOpenChange={setShowPayrollForm}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">Add Payroll Entry</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Payroll Entry</DialogTitle>
              </DialogHeader>
              <PayrollForm 
                employee={{
                  id: selectedEmployee?.id || '',
                  name: selectedEmployee?.name || '',
                  department: selectedEmployee?.department,
                  salary: selectedEmployee?.salary
                }}
                onSuccess={() => {
                  setShowPayrollForm(false)
                  window.location.reload()
                }}
                onCancel={() => setShowPayrollForm(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-primary/20 shadow-lg">
        <CardHeader>
          <CardTitle className="text-primary">Payroll Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <PayrollSummary report={currentReport} />
        </CardContent>
      </Card>

      <Card className="border-primary/20 shadow-lg">
        <CardHeader>
          <CardTitle className="text-primary">Employee List</CardTitle>
          <Input
            placeholder="Search employees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm border-primary/20 focus:border-primary"
          />
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border border-primary/20">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-primary/5">
                  <th className="h-12 px-4 text-left align-middle font-medium text-primary">Name</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-primary">Email</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-primary">Department</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-primary">Status</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-primary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-muted-foreground">
                      No employees found
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((employee) => (
                    <tr 
                      key={employee.id}
                      className="border-b transition-colors hover:bg-primary/5"
                    >
                      <td className="p-4 align-middle">
                        <div className="flex items-center gap-2">
                          {employee.profileImage ? (
                            <img 
                              src={employee.profileImage} 
                              alt={employee.name}
                              className="h-8 w-8 rounded-full ring-2 ring-primary/20"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-medium ring-2 ring-primary/20">
                              {employee.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="font-medium text-primary/90">{employee.name}</span>
                        </div>
                      </td>
                      <td className="p-4 align-middle text-muted-foreground">{employee.email}</td>
                      <td className="p-4 align-middle">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${getDepartmentColor(employee.department).bg} ${getDepartmentColor(employee.department).text} ${getDepartmentColor(employee.department).border}`}>
                          {employee.department || 'Unassigned'}
                        </span>
                      </td>
                      <td className="p-4 align-middle">
                        {employee.lastPayrollDate ? (
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-4 w-4" />
                            Processed {format(new Date(employee.lastPayrollDate), 'MMM d, yyyy')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-yellow-600">
                            <AlertCircle className="h-4 w-4" />
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="p-4 align-middle">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (employee && employee.id && employee.name) {
                              setSelectedEmployee(employee)
                              setShowPayrollForm(true)
                            } else {
                              setError('Invalid employee data')
                            }
                          }}
                          disabled={processingPayroll === employee.id || !!employee.lastPayrollDate}
                          className="h-8 bg-gradient-to-r from-primary to-primary/80 text-white hover:from-primary/90 hover:to-primary/70 shadow-sm transition-all duration-200 hover:shadow-md disabled:opacity-50"
                        >
                          {processingPayroll === employee.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Process Payroll'
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showPayrollForm} onOpenChange={setShowPayrollForm}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Process Payroll</DialogTitle>
          </DialogHeader>
          {selectedEmployee && selectedEmployee.id && selectedEmployee.name ? (
            <PayrollForm
              employee={{
                id: selectedEmployee?.id || '',
                name: selectedEmployee?.name || '',
                department: selectedEmployee?.department,
                salary: selectedEmployee?.salary
              }}
              onSuccess={() => {
                setShowPayrollForm(false)
                window.location.reload()
              }}
              onCancel={() => setShowPayrollForm(false)}
            />
          ) : (
            <div className="p-4 text-center text-red-600">
              Invalid employee data. Please try again.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
} 