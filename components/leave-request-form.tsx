'use client'

import { useState, useEffect } from 'react'
import { LeaveType, LeaveRequest, LeaveBalance } from '@/types/leave'
import { useNewAuth } from '@/contexts/new-auth-context'
import { db } from '@/lib/firebase'
import { collection, addDoc, doc, getDoc } from 'firebase/firestore'
import { toast } from 'react-hot-toast'
import { differenceInDays } from 'date-fns'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface LeaveRequestFormProps {
  onClose: () => void
  onSuccess: () => void
  isOpen: boolean
}

const LEAVE_TYPES = [
  { value: 'annual', label: 'Annual Leave' },
  { value: 'sick', label: 'Sick Leave' },
  { value: 'personal', label: 'Personal Leave' },
  { value: 'maternity', label: 'Maternity Leave' },
  { value: 'paternity', label: 'Paternity Leave' },
  { value: 'bereavement', label: 'Bereavement Leave' },
  { value: 'unpaid', label: 'Unpaid Leave' }
]

export function LeaveRequestForm({ onClose, onSuccess, isOpen }: LeaveRequestFormProps) {
  const { user } = useNewAuth()
  const [loading, setLoading] = useState(false)
  const [balance, setBalance] = useState<LeaveBalance | null>(null)
  const [formData, setFormData] = useState({
    type: 'annual' as LeaveType,
    startDate: '',
    endDate: '',
    reason: '',
    attachments: [] as string[]
  })
  const [daysRequested, setDaysRequested] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
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

      const days = differenceInDays(end, start) + 1
      setDaysRequested(days)
      setError('')
    }
  }, [formData.startDate, formData.endDate])

  const fetchLeaveBalance = async () => {
    if (!user?.id) return

    try {
      const currentYear = new Date().getFullYear()
      const balanceRef = doc(db, 'leaveBalances', `${user.id}_${currentYear}`)
      const balanceDoc = await getDoc(balanceRef)

      if (balanceDoc.exists()) {
        setBalance(balanceDoc.data() as LeaveBalance)
      } else {
        // Create default balance if none exists
        const defaultBalance: LeaveBalance = {
          employeeId: user.id,
          year: currentYear,
          annual: 20,
          sick: 10,
          personal: 5,
          maternity: 90,
          paternity: 14,
          bereavement: 5,
          unpaid: 365,
          updatedAt: new Date()
        }
        setBalance(defaultBalance)
      }
    } catch (error) {
      console.error('Error fetching leave balance:', error)
      toast.error('Failed to fetch leave balance')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !balance) return

    try {
      setLoading(true)

      // Validate dates
      const start = new Date(formData.startDate)
      const end = new Date(formData.endDate)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      if (end < start) {
        setError('End date cannot be before start date')
        return
      }

      if (start < today) {
        setError('Cannot request leave for past dates')
        return
      }

      // Check if there's sufficient balance
      const balanceKey = formData.type as keyof LeaveBalance
      const availableDays = balance[balanceKey] as number

      if (daysRequested > availableDays) {
        setError(`Insufficient ${formData.type} leave balance. Available: ${availableDays} days`)
        return
      }

      const leaveRequest: Omit<LeaveRequest, 'id'> = {
        employeeId: user.id,
        employeeName: user.name || user.email || 'Unknown',
        department: user.department || 'Unassigned',
        type: formData.type,
        startDate: start,
        endDate: end,
        status: 'pending',
        reason: formData.reason,
        createdAt: new Date(),
        updatedAt: new Date(),
        attachments: formData.attachments
      }

      await addDoc(collection(db, 'leaveRequests'), leaveRequest)
      toast.success('Leave request submitted successfully')
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error submitting leave request:', error)
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
          {/* Leave Type */}
          <div className="space-y-2">
            <label htmlFor="type" className="text-sm font-medium">
              Leave Type
            </label>
            <select
              id="type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as LeaveType })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
              required
            >
              <option value="">Select leave type</option>
              <option value="annual">Annual Leave</option>
              <option value="sick">Sick Leave</option>
              <option value="personal">Personal Leave</option>
              <option value="maternity">Maternity Leave</option>
              <option value="paternity">Paternity Leave</option>
              <option value="bereavement">Bereavement Leave</option>
              <option value="unpaid">Unpaid Leave</option>
            </select>
          </div>

          {/* Date Range */}
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                required
              />
            </div>
          </div>

          {/* Reason */}
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base resize-none"
              required
            />
          </div>

          {/* Mobile-friendly buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-3 text-base font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !!error}
              className="w-full sm:w-auto px-6 py-3 text-base font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
} 