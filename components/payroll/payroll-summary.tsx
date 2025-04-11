'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { formatCurrency } from '@/lib/utils'
import { PayrollReport } from '@/types/payroll'

interface PayrollSummaryProps {
  report: PayrollReport
}

export function PayrollSummary({ report }: PayrollSummaryProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{report.summary.totalEmployees}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Total Gross Salary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD'
            }).format(report.summary.totalGrossSalary)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Total Net Salary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD'
            }).format(report.summary.totalNetSalary)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Total Deductions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD'
            }).format(report.summary.totalDeductions)}
          </div>
        </CardContent>
      </Card>

      <div className="col-span-full">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Department Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {report.summary.byDepartment.map((dept) => (
                <Card key={dept.department} className="border-primary/10">
                  <CardHeader>
                    <CardTitle className="text-lg">{dept.department}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Employees</span>
                        <span className="font-medium">{dept.count}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Gross Salary</span>
                        <span className="font-medium">
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD'
                          }).format(dept.grossSalary)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Net Salary</span>
                        <span className="font-medium">
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD'
                          }).format(dept.netSalary)}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">Status</span>
                          <div className="flex gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              dept.status.pending > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                            }`}>
                              {dept.status.pending > 0 ? 'Pending' : 'Processed'}
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{
                              width: `${(dept.status.processed / dept.status.total) * 100}%`
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>{dept.status.processed} processed</span>
                          <span>{dept.status.pending} pending</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 