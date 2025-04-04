'use client'

import { AttendanceRecord } from '@/types/attendance'
import { format } from 'date-fns'
import { Clock, MapPin, Smartphone, CheckCircle, XCircle } from 'lucide-react'

interface AttendanceTableMobileProps {
  records: AttendanceRecord[]
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
}

export function AttendanceTableMobile({ records, onApprove, onReject }: AttendanceTableMobileProps) {
  return (
    <div className="space-y-4">
      {records.map((record) => (
        <div
          key={record.id}
          className="bg-white rounded-lg border border-gray-200 p-4"
        >
          {/* Header */}
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="font-medium">{record.employeeName}</h3>
              <p className="text-sm text-gray-500">{record.department}</p>
            </div>
            <span
              className={`px-2 py-1 text-xs font-medium rounded-full ${
                record.status === 'present'
                  ? 'bg-green-100 text-green-800'
                  : record.status === 'late'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {(record.status || 'unknown').charAt(0).toUpperCase() + (record.status || 'unknown').slice(1)}
            </span>
          </div>

          {/* Date */}
          <div className="text-sm text-gray-600 mb-3">
            {format(record.date, 'MMMM d, yyyy')}
          </div>

          {/* Check-in Details */}
          <div className="space-y-2 mb-3">
            <div className="flex items-center text-sm">
              <Clock className="h-4 w-4 text-gray-400 mr-2" />
              <span className="text-gray-600">Check-in:</span>
              <span className="ml-2 font-medium">
                {format(record.checkIn?.time || new Date(), 'h:mm a')}
              </span>
            </div>

            {record.checkOut && (
              <div className="flex items-center text-sm">
                <Clock className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-gray-600">Check-out:</span>
                <span className="ml-2 font-medium">
                  {format(record.checkOut.time, 'h:mm a')}
                </span>
              </div>
            )}

            <div className="flex items-center text-sm">
              <MapPin className="h-4 w-4 text-gray-400 mr-2" />
              <span className="text-gray-600">Location:</span>
              <span className="ml-2 font-medium">
                {record.checkIn?.location ? 'Verified' : 'Not verified'}
              </span>
            </div>

            <div className="flex items-center text-sm">
              <Smartphone className="h-4 w-4 text-gray-400 mr-2" />
              <span className="text-gray-600">Device:</span>
              <span className="ml-2 font-medium">
                {record.checkIn?.deviceInfo ? 'Verified' : 'Not verified'}
              </span>
            </div>
          </div>

          {/* Approval Status */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center text-sm">
              {record.approvalStatus === 'approved' ? (
                <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
              ) : record.approvalStatus === 'rejected' ? (
                <XCircle className="h-4 w-4 text-red-500 mr-1" />
              ) : null}
              <span className="text-gray-600">
                {(record.approvalStatus || 'pending').charAt(0).toUpperCase() + (record.approvalStatus || 'pending').slice(1)}
              </span>
            </div>

            {/* Approval Actions */}
            {onApprove && onReject && record.approvalStatus === 'pending' && (
              <div className="flex space-x-2">
                <button
                  onClick={() => onReject(record.id)}
                  className="px-3 py-1 text-sm text-red-600 hover:text-red-800"
                >
                  Reject
                </button>
                <button
                  onClick={() => onApprove(record.id)}
                  className="px-3 py-1 text-sm text-green-600 hover:text-green-800"
                >
                  Approve
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
} 