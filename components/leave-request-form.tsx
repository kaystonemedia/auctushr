'use client'

import { useState, useEffect } from 'react'
import { LeaveType, LeaveBalance } from '@/types/leave'
import { useNewAuth } from '@/contexts/new-auth-context'
import { toast } from 'react-hot-toast'
import { differenceInDays } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface LeaveRequestFormProps {
  onClose: () => void
  onSuccess: () => void
  isOpen: boolean
}

export function LeaveRequestForm({ onClose, onSuccess, isOpen }: LeaveRequestFormProps) {
  const { user } = useNewAuth()
  const [loading, setLoading] = useState(false)
  const [balance, setBalance] = useState<LeaveBalance | null>(null)
  const [formData, setFormData] = useState({
    type: 'annual' as LeaveType,
    startDate: '',
    endDate: '',
    reason: '',
    attachments: [] as string[],
  })
  const [daysRequested, setDaysRequested] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchLeaveBalance = async () => {
      if (!user?.id) return
      try {
        const res = await fetch('/api/leave/balance', { credentials: 'include' })
        if (!res.ok) throw new Error('Failed to load balance')
        const data = await res.json()
        setBalance({ ...data.balance, updatedAt: new Date(data.balance.updatedAt) })
      } catch (err) {
        console.error('Error fetching leave balance:', err)
        toast.error('Failed to fetch leave balance')
      }
    }
    fetchLeaveBalance()
  }, [user?.id])

  useEffect(() => {
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate)
      const end = new Date(formData.endDate)
      if (end < start) {
        setError('End date cannot be before start date')
        setDaysRequested(0)
        return
      }
      setDaysRequested(differenceInDays(end, start) + 1)
      setError('')
    }
  }, [formData.startDate, formData.endDate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !balance) return

    try {
      setLoading(true)
      setError('')

      const balanceKey = formData.type as keyof LeaveBalance
      const availableDays = balance[balanceKey] as number
      if (daysRequested > availableDays) {
        setError(`Insufficient ${formData.type} leave balance. Available: ${availableDays} days`)
        return
      }

      const res = await fetch('/api/leave/requests', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: formData.type,
          startDate: formData.startDate,
          endDate: formData.endDate,
          reason: formData.reason,
          attachments: formData.attachments,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to submit leave request')
        return
      }

      toast.success('Leave request submitted successfully')
      onSuccess()
      onClose()
    } catch (err) {
      console.error('Error submitting leave request:', err)
      toast.error('Failed to submit leave request')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Leave</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="type" className="text-sm font-medium">
              Leave Type
            </label>
            <select
              id="type"
              value={formData.type}
              onChange={(e) => {
                setFormData({ ...formData, type: e.target.value as LeaveType })
                setError('')
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
              required
            >
              <option value="annual">Annual Leave</option>
              <option value="sick">Sick Leave</option>
              <option value="personal">Personal Leave</option>
              <option value="maternity">Maternity Leave</option>
              <option value="paternity">Paternity Leave</option>
              <option value="bereavement">Bereavement Leave</option>
              <option value="unpaid">Unpaid Leave</option>
            </select>
            {balance && (
              <p className="text-xs text-gray-500">
                Available: {balance[formData.type as keyof LeaveBalance] as number} days
                {daysRequested > 0 && ` · Requesting ${daysRequested} days`}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="startDate" className="text-sm font-medium">
                Start Date
              </label>
              <input
                type="date"
                id="startDate"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="endDate" className="text-sm font-medium">
                End Date
              </label>
              <input
                type="date"
                id="endDate"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="reason" className="text-sm font-medium">
              Reason
            </label>
            <textarea
              id="reason"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Please provide a reason for your leave request..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-3 text-base font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !!error}
              className="w-full sm:w-auto px-6 py-3 text-base font-medium text-white bg-blue-600 rounded-lg disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
