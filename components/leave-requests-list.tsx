'use client'

import { useState, useEffect, useCallback } from 'react'
import { LeaveRequest } from '@/types/leave'
import { useNewAuth } from '@/contexts/new-auth-context'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'
import { Calendar, Activity, Heart, Baby, Users, Umbrella, Clock } from 'lucide-react'

interface LeaveRequestsListProps {
  view: 'all' | 'pending' | 'my'
}

const typeIcons: Record<string, typeof Calendar> = {
  annual: Calendar,
  sick: Activity,
  personal: Heart,
  maternity: Baby,
  paternity: Users,
  bereavement: Umbrella,
  unpaid: Clock,
}

export function LeaveRequestsList({ view }: LeaveRequestsListProps) {
  const { user } = useNewAuth()
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/leave/requests?view=${view}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load leave requests')
      const data = await res.json()
      setRequests(
        (data.requests || []).map((r: LeaveRequest) => ({
          ...r,
          startDate: new Date(r.startDate),
          endDate: new Date(r.endDate),
          createdAt: new Date(r.createdAt),
          updatedAt: new Date(r.updatedAt),
          approvedAt: r.approvedAt ? new Date(r.approvedAt) : undefined,
          rejectedAt: r.rejectedAt ? new Date(r.rejectedAt) : undefined,
        }))
      )
    } catch (err) {
      console.error('Error fetching leave requests:', err)
    } finally {
      setLoading(false)
    }
  }, [view])

  useEffect(() => {
    if (!user) return
    loadRequests()
    const interval = setInterval(loadRequests, 45_000)
    return () => clearInterval(interval)
  }, [view, user, loadRequests])

  const handleStatusUpdate = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const res = await fetch(`/api/leave/requests/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Update failed')
      toast.success(
        status === 'approved'
          ? 'Leave request approved. Employee has been notified.'
          : 'Leave request rejected. Employee has been notified.'
      )
      await loadRequests()
    } catch (err) {
      console.error('Error updating leave status:', err)
      toast.error('Failed to update leave request')
    }
  }

  if (loading) {
    return <div className="text-center py-4 text-gray-500">Loading...</div>
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No leave requests found.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => {
        const Icon = typeIcons[request.type] || Calendar
        return (
          <div
            key={request.id}
            className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
          >
            <div className="flex justify-between items-start">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-emerald-mint/10 rounded-lg">
                  <Icon className="h-5 w-5 text-emerald-mint" />
                </div>
                <div>
                  <h3 className="font-medium capitalize">{request.type} Leave</h3>
                  <p className="text-sm text-gray-500">{request.employeeName}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    {format(request.startDate, 'MMM d')} – {format(request.endDate, 'MMM d, yyyy')}
                  </p>
                  {request.reason && (
                    <p className="text-sm text-gray-500 mt-1">{request.reason}</p>
                  )}
                </div>
              </div>
              <span
                className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${
                  request.status === 'approved'
                    ? 'bg-green-100 text-green-800'
                    : request.status === 'rejected'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {request.status}
              </span>
            </div>
            {request.status === 'pending' &&
              (user?.role === 'admin' || user?.role === 'manager') && (
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleStatusUpdate(request.id, 'approved')}
                    className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleStatusUpdate(request.id, 'rejected')}
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Reject
                  </button>
                </div>
              )}
          </div>
        )
      })}
    </div>
  )
}
