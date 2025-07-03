'use client'

import { useState, useEffect } from 'react'
import { LeaveRequest, LeaveStatus } from '@/types/leave'
import { useNewAuth } from '@/contexts/new-auth-context'
import { db } from '@/lib/firebase'
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, Timestamp, getDocs, getDoc } from 'firebase/firestore'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'
import { Calendar, Activity, Heart, Baby, Users, Umbrella, Clock } from 'lucide-react'

interface LeaveRequestsListProps {
  view: 'all' | 'pending' | 'my'
}

// Helper to safely convert Firestore Timestamp or Date/string to Date
const toDateSafe = (val: any) => (val && typeof val.toDate === 'function' ? val.toDate() : val);

const typeIcons: Record<string, any> = {
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

  useEffect(() => {
    let q = query(collection(db, 'leaveRequests'), orderBy('createdAt', 'desc'))
    if (view === 'pending') {
      q = query(q, where('status', '==', 'pending'))
    } else if (view === 'my' && user) {
      q = query(q, where('employeeId', '==', user.id))
    }
    const unsub = onSnapshot(q, (querySnapshot) => {
      const requestsList = querySnapshot.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          ...data,
          startDate: toDateSafe(data.startDate) || new Date(),
          endDate: toDateSafe(data.endDate) || new Date(),
          createdAt: toDateSafe(data.createdAt) || new Date(),
          updatedAt: toDateSafe(data.updatedAt) || new Date(),
          approvedAt: toDateSafe(data.approvedAt),
          rejectedAt: toDateSafe(data.rejectedAt)
        }
      }) as LeaveRequest[]
      setRequests(requestsList)
      setLoading(false)
    }, (err) => { console.error('Error fetching leave requests:', err); setLoading(false) })
    return () => unsub()
  }, [view, user])

  const handleStatusUpdate = async (id: string, status: 'approved' | 'rejected') => {
    const leaveRef = doc(db, 'leaveRequests', id)
    const leaveDoc = await getDoc(leaveRef)
    if (!leaveDoc.exists) return
    const leaveData = leaveDoc.data()
    const updateData: { status: 'approved' | 'rejected', updatedAt: Timestamp, approvedAt?: Timestamp, rejectedAt?: Timestamp } = { status, updatedAt: Timestamp.now() }
    if (status === 'approved') updateData.approvedAt = Timestamp.now()
    else if (status === 'rejected') updateData.rejectedAt = Timestamp.now()
    await updateDoc(leaveRef, updateData)
  }

  if (loading) {
    return <div className="text-center py-4 text-gray-500">Loading...</div>
  }

  return (
    <div className="space-y-6">
      {requests.length === 0 ? (
        <div className="text-center py-4 text-gray-500">
          No leave requests found
        </div>
      ) : (
        requests.map((request) => {
          const TypeIcon = typeIcons[request.type] || Calendar
          return (
            <div
              key={request.id}
              className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg transition-shadow duration-200 group"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-50 text-blue-600 rounded-full p-2">
                    <TypeIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base">{request.employeeName}</h3>
                    <p className="text-xs text-gray-400">{request.department}</p>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 text-xs font-semibold rounded-full shadow-sm
                    ${request.status === 'approved' ? 'bg-green-100 text-green-700' :
                      request.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      request.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'}
                  `}
                >
                  {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                </span>
              </div>

              <div className="flex flex-wrap gap-4 items-center text-sm mb-2">
                <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 rounded-full px-3 py-1 text-xs font-medium">
                  <TypeIcon className="h-4 w-4" />
                  {request.type.charAt(0).toUpperCase() + request.type.slice(1)}
                </span>
                <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 rounded-full px-3 py-1 text-xs font-medium">
                  <Calendar className="h-4 w-4" />
                  {`${format(new Date(request.startDate), 'MMM d, yyyy')} - ${format(new Date(request.endDate), 'MMM d, yyyy')}`}
                </span>
              </div>

              <div className="mb-2">
                <p className="text-xs text-gray-500 mb-1">Reason</p>
                <p className="text-sm text-gray-800 font-medium">{request.reason}</p>
              </div>

              {user?.role !== 'employee' && request.status === 'pending' && (
                <div className="mt-4 flex justify-end space-x-2">
                  <button
                    onClick={() => handleStatusUpdate(request.id, 'rejected')}
                    className="px-4 py-1.5 text-sm font-semibold text-red-600 bg-red-50 rounded-full hover:bg-red-100 transition-colors"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleStatusUpdate(request.id, 'approved')}
                    className="px-4 py-1.5 text-sm font-semibold text-green-600 bg-green-50 rounded-full hover:bg-green-100 transition-colors"
                  >
                    Approve
                  </button>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
} 