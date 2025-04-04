'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { formatCurrency } from '@/lib/utils'

interface PayrollSummaryProps {
  report?: {
    summary?: {
      totalEmployees: number
      totalGrossSalary: number
      totalNetSalary: number
      totalDeductions: number
      totalAllowances: number
      byDepartment: Array<{
        department: string
        count: number
        grossSalary: number
        netSalary: number
      }>
      byStatus: Array<{
        status: string
        count: number
      }>
    }
  }
}

export function PayrollSummary({ report }: PayrollSummaryProps) {
  // Provide default values if report or summary is undefined
  const summary = report?.summary || {
    totalEmployees: 0,
    totalGrossSalary: 0,
    totalNetSalary: 0,
    totalDeductions: 0,
    totalAllowances: 0,
    byDepartment: [],
    byStatus: []
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="bg-primary/5">
        <CardContent className="p-6">
          <div className="text-sm font-medium text-primary/70">Total Employees</div>
          <div className="mt-2 text-2xl font-bold text-primary">{summary.totalEmployees}</div>
          <Progress value={100} className="mt-2" />
        </CardContent>
      </Card>

      <Card className="bg-green-50">
        <CardContent className="p-6">
          <div className="text-sm font-medium text-green-700">Gross Salary</div>
          <div className="mt-2 text-2xl font-bold text-green-700">
            {formatCurrency(summary.totalGrossSalary)}
          </div>
          <Progress value={100} className="mt-2 bg-green-100" />
        </CardContent>
      </Card>

      <Card className="bg-red-50">
        <CardContent className="p-6">
          <div className="text-sm font-medium text-red-700">Total Deductions</div>
          <div className="mt-2 text-2xl font-bold text-red-700">
            {formatCurrency(summary.totalDeductions)}
          </div>
          <Progress value={100} className="mt-2 bg-red-100" />
        </CardContent>
      </Card>

      <Card className="bg-blue-50">
        <CardContent className="p-6">
          <div className="text-sm font-medium text-blue-700">Net Salary</div>
          <div className="mt-2 text-2xl font-bold text-blue-700">
            {formatCurrency(summary.totalNetSalary)}
          </div>
          <Progress value={100} className="mt-2 bg-blue-100" />
        </CardContent>
      </Card>

      <Card className="col-span-full">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Department Breakdown</h3>
          <div className="space-y-4">
            {summary.byDepartment.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                No department data available
              </div>
            ) : (
              summary.byDepartment.map((dept) => (
                <div key={dept.department} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{dept.department}</span>
                    <span className="text-muted-foreground">
                      {dept.count} employees
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600">
                      {formatCurrency(dept.grossSalary)}
                    </span>
                    <span className="text-blue-600">
                      {formatCurrency(dept.netSalary)}
                    </span>
                  </div>
                  <Progress 
                    value={summary.totalGrossSalary > 0 ? (dept.grossSalary / summary.totalGrossSalary) * 100 : 0} 
                    className="h-2"
                  />
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="col-span-full">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Status Distribution</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {summary.byStatus.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                No status data available
              </div>
            ) : (
              summary.byStatus.map((status) => (
                <div key={status.status} className="space-y-2">
                  <div className="text-sm font-medium capitalize">{status.status}</div>
                  <div className="text-2xl font-bold text-primary">{status.count}</div>
                  <Progress 
                    value={summary.totalEmployees > 0 ? (status.count / summary.totalEmployees) * 100 : 0} 
                    className="h-2"
                  />
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 