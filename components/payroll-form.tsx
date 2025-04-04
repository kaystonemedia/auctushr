import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { X } from "lucide-react"
import { Employee, PayrollFormData } from "@/types/payroll"

interface PayrollFormProps {
  onClose: () => void
  onSubmit: (data: PayrollFormData) => void
  employee: Employee | null
}

export function PayrollForm({ onClose, onSubmit, employee }: PayrollFormProps) {
  const [formData, setFormData] = useState<PayrollFormData>({
    baseSalary: employee?.baseSalary || 0,
    bonuses: {
      performance: 0,
      overtime: 0,
      other: 0,
    },
    deductions: {
      tax: 0,
      insurance: 0,
      other: 0,
    },
    notes: "",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const calculateTotal = () => {
    const totalBonuses = Object.values(formData.bonuses).reduce((a, b) => a + b, 0)
    const totalDeductions = Object.values(formData.deductions).reduce((a, b) => a + b, 0)
    return formData.baseSalary + totalBonuses - totalDeductions
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Process Payroll</span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              <X className="h-5 w-5" />
            </button>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
              <div className="text-sm text-gray-900">{employee?.name}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <div className="text-sm text-gray-900">{employee?.department}</div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Base Salary</label>
            <input
              type="number"
              value={formData.baseSalary}
              onChange={(e) => setFormData({ ...formData, baseSalary: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
              min="0"
              step="0.01"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Bonuses</label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Performance</label>
                <input
                  type="number"
                  value={formData.bonuses.performance}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      bonuses: { ...formData.bonuses, performance: Number(e.target.value) },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Overtime</label>
                <input
                  type="number"
                  value={formData.bonuses.overtime}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      bonuses: { ...formData.bonuses, overtime: Number(e.target.value) },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Other</label>
                <input
                  type="number"
                  value={formData.bonuses.other}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      bonuses: { ...formData.bonuses, other: Number(e.target.value) },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Deductions</label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Tax</label>
                <input
                  type="number"
                  value={formData.deductions.tax}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      deductions: { ...formData.deductions, tax: Number(e.target.value) },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Insurance</label>
                <input
                  type="number"
                  value={formData.deductions.insurance}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      deductions: { ...formData.deductions, insurance: Number(e.target.value) },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Other</label>
                <input
                  type="number"
                  value={formData.deductions.other}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      deductions: { ...formData.deductions, other: Number(e.target.value) },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
              rows={3}
              placeholder="Add any additional notes..."
            />
          </div>

          <div className="bg-gray-50 p-4 rounded-md">
            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-700">Total Net Pay</span>
              <span className="text-xl font-bold text-gray-900">${calculateTotal().toFixed(2)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="text-gray-700">
              Cancel
            </Button>
            <Button type="submit" className="bg-blue-500 hover:bg-blue-600 text-white">
              Process Payroll
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
} 