'use client'

import { useState, useEffect } from 'react'
import { LeaveRequest, LeaveStatus } from '@/types/leave'
import { useAuth } from '@/contexts/auth-context'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'

interface LeaveRequestsListProps {
  view: 'all' | 'pending' | 'my'
}

export function LeaveRequestsList({ view }: LeaveRequestsListProps) {
  const { user } = useAuth()
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLeaveRequests()
  }, [view])

  const fetchLeaveRequests = async () => {
    try {
      setLoading(true)
      let q = query(collection(db, 'leaveRequests'))

      if (view === 'pending' && user?.role !== 'employee') {
        q = query(q, where('status', '==', 'pending'))
      } else if (view === 'my' && user) {
        q = query(q, where('employeeId', '==', user.id))
      }

      const querySnapshot = await getDocs(q)
      const requestsList = querySnapshot.docs.map(doc => {
        const data = doc.data()
        // Convert Firestore Timestamps to Date objects
        return {
          id: doc.id,
          ...data,
          startDate: data.startDate?.toDate() || new Date(),
          endDate: data.endDate?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          approvedAt: data.approvedAt?.toDate(),
          rejectedAt: data.rejectedAt?.toDate()
        }
      }) as LeaveRequest[]

      setRequests(requestsList)
    } catch (error) {
      console.error('Error fetching leave requests:', error)
      toast.error('Failed to fetch leave requests')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (requestId: string, status: LeaveStatus) => {
    if (!user) return

    try {
      const requestRef = doc(db, 'leaveRequests', requestId)
      const updateData: Partial<LeaveRequest> = {
        status,
        updatedAt: new Date(),
        [`${status}edBy`]: user.id,
        [`${status}edAt`]: new Date()
      }

      await updateDoc(requestRef, updateData)
      toast.success(`Leave request ${status} successfully`)
      fetchLeaveRequests()
    } catch (error) {
      console.error('Error updating leave request:', error)
      toast.error('Failed to update leave request')
    }
  }

  if (loading) {
    return <div className="text-center py-4">Loading...</div>
  }

  return (
    <div className="space-y-4">
      {requests.length === 0 ? (
        <div className="text-center py-4 text-gray-500">
          No leave requests found
        </div>
      ) : (
        requests.map((request) => (
          <div
            key={request.id}
            className="bg-white p-4 rounded-lg border border-gray-200"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium">{request.employeeName}</h3>
                <p className="text-sm text-gray-500">{request.department}</p>
              </div>
              <span
                className={`px-2 py-1 text-xs font-medium rounded-full ${
                  request.status === 'approved'
                    ? 'bg-green-100 text-green-800'
                    : request.status === 'rejected'
                    ? 'bg-red-100 text-red-800'
                    : request.status === 'pending'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Type</p>
                <p className="font-medium">{request.type}</p>
              </div>
              <div>
                <p className="text-gray-500">Duration</p>
                <p className="font-medium">
                  {format(new Date(request.startDate), 'MMM d, yyyy')} -{' '}
                  {format(new Date(request.endDate), 'MMM d, yyyy')}
                </p>
              </div>
            </div>

            <div className="mt-2">
              <p className="text-gray-500">Reason</p>
              <p className="mt-1">{request.reason}</p>
            </div>

            {user?.role !== 'employee' && request.status === 'pending' && (
              <div className="mt-4 flex justify-end space-x-2">
                <button
                  onClick={() => handleStatusUpdate(request.id, 'rejected')}
                  className="px-3 py-1 text-sm text-red-600 hover:text-red-800"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleStatusUpdate(request.id, 'approved')}
                  className="px-3 py-1 text-sm text-green-600 hover:text-green-800"
                >
                  Approve
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
} 