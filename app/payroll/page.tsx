'use client'

import { PayrollDashboard } from "@/components/payroll/payroll-dashboard"

export default function PayrollPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Payroll</h1>
      </div>
      <PayrollDashboard />
    </div>
  )
} 