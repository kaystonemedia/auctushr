'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { collection, addDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

interface PayrollFormProps {
  employee: {
    id: string
    name: string
    department?: string
    salary?: number
  }
  onSuccess: () => void
  onCancel: () => void
}

export function PayrollForm({ employee, onSuccess, onCancel }: PayrollFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Add validation check at the start of the component
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

  const [formData, setFormData] = useState({
    baseSalary: employee?.salary ?? 0,
    bonuses: {
      performance: 0,
      overtime: 0,
      other: 0
    },
    deductions: {
      tax: 0,
      insurance: 0,
      other: 0
    },
    allowances: {
      housing: 0,
      transport: 0,
      other: 0
    },
    notes: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Calculate totals
      const totalBonuses = 
        formData.bonuses.performance + 
        formData.bonuses.overtime + 
        formData.bonuses.other

      const totalDeductions = 
        formData.deductions.tax + 
        formData.deductions.insurance + 
        formData.deductions.other

      const totalAllowances = 
        formData.allowances.housing + 
        formData.allowances.transport + 
        formData.allowances.other

      const grossSalary = formData.baseSalary + totalBonuses
      const netSalary = grossSalary - totalDeductions + totalAllowances

      // Add payroll entry
      const payrollEntry = {
        employeeId: employee.id,
        employeeName: employee.name,
        department: employee.department,
        baseSalary: formData.baseSalary,
        bonuses: formData.bonuses,
        deductions: formData.deductions,
        allowances: formData.allowances,
        grossSalary,
        netSalary,
        totalBonuses,
        totalDeductions,
        totalAllowances,
        notes: formData.notes,
        processedAt: new Date().toISOString()
      }

      await addDoc(collection(db, 'payrollEntries'), payrollEntry)
      onSuccess()
    } catch (err) {
      console.error('Error processing payroll:', err)
      setError(err instanceof Error ? err.message : 'Failed to process payroll')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Process Payroll for {employee.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="baseSalary">Base Salary</Label>
              <Input
                id="baseSalary"
                type="number"
                value={formData.baseSalary}
                onChange={e => setFormData(prev => ({
                  ...prev,
                  baseSalary: Number(e.target.value)
                }))}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="performanceBonus">Performance Bonus</Label>
                <Input
                  id="performanceBonus"
                  type="number"
                  value={formData.bonuses.performance}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    bonuses: {
                      ...prev.bonuses,
                      performance: Number(e.target.value)
                    }
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="overtimeBonus">Overtime Bonus</Label>
                <Input
                  id="overtimeBonus"
                  type="number"
                  value={formData.bonuses.overtime}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    bonuses: {
                      ...prev.bonuses,
                      overtime: Number(e.target.value)
                    }
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="otherBonus">Other Bonus</Label>
                <Input
                  id="otherBonus"
                  type="number"
                  value={formData.bonuses.other}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    bonuses: {
                      ...prev.bonuses,
                      other: Number(e.target.value)
                    }
                  }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="tax">Tax</Label>
                <Input
                  id="tax"
                  type="number"
                  value={formData.deductions.tax}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    deductions: {
                      ...prev.deductions,
                      tax: Number(e.target.value)
                    }
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="insurance">Insurance</Label>
                <Input
                  id="insurance"
                  type="number"
                  value={formData.deductions.insurance}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    deductions: {
                      ...prev.deductions,
                      insurance: Number(e.target.value)
                    }
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="otherDeduction">Other Deductions</Label>
                <Input
                  id="otherDeduction"
                  type="number"
                  value={formData.deductions.other}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    deductions: {
                      ...prev.deductions,
                      other: Number(e.target.value)
                    }
                  }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="housingAllowance">Housing Allowance</Label>
                <Input
                  id="housingAllowance"
                  type="number"
                  value={formData.allowances.housing}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    allowances: {
                      ...prev.allowances,
                      housing: Number(e.target.value)
                    }
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="transportAllowance">Transport Allowance</Label>
                <Input
                  id="transportAllowance"
                  type="number"
                  value={formData.allowances.transport}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    allowances: {
                      ...prev.allowances,
                      transport: Number(e.target.value)
                    }
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="otherAllowance">Other Allowance</Label>
                <Input
                  id="otherAllowance"
                  type="number"
                  value={formData.allowances.other}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    allowances: {
                      ...prev.allowances,
                      other: Number(e.target.value)
                    }
                  }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={e => setFormData(prev => ({
                  ...prev,
                  notes: e.target.value
                }))}
                placeholder="Add any additional notes"
              />
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <Button 
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Process Payroll
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
} 