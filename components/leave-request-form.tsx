'use client'

import { useState, useEffect } from 'react'
import { LeaveType, LeaveRequest, LeaveBalance } from '@/types/leave'
import { useAuth } from '@/contexts/auth-context'
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

interface LeaveRequestFormProps {
  onClose: () => void
  onSuccess: () => void
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

export function LeaveRequestForm({ onClose, onSuccess }: LeaveRequestFormProps) {
  const { user } = useAuth()
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Leave Type</Label>
          <Select
          value={formData.type}
            onValueChange={(value) => setFormData({ ...formData, type: value as LeaveType })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAVE_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              min={new Date().toISOString().split('T')[0]}
            required
          />
        </div>
          <div className="space-y-2">
            <Label>End Date</Label>
            <Input
            type="date"
            value={formData.endDate}
            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              min={formData.startDate || new Date().toISOString().split('T')[0]}
            required
          />
        </div>
      </div>

      {daysRequested > 0 && balance && (
          <div className="bg-muted rounded-lg p-4">
            <div className="space-y-1">
              <p className="text-sm">
            Days requested: <span className="font-medium">{daysRequested}</span>
          </p>
              <p className="text-sm">
            Available balance: <span className="font-medium">{String(balance[formData.type as keyof LeaveBalance])}</span> days
          </p>
            </div>
        </div>
      )}

        <div className="space-y-2">
          <Label>Reason</Label>
          <Textarea
          value={formData.reason}
          onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            placeholder="Please provide a reason for your leave request"
            className="min-h-[100px]"
          required
        />
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive rounded-lg p-4">
            <p className="text-sm">{error}</p>
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-3">
        <Button variant="outline" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading || !!error}>
          {loading ? 'Submitting...' : 'Submit Request'}
        </Button>
      </div>
    </form>
  )
} 