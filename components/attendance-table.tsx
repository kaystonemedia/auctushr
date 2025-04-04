'use client'
import { useState, useEffect } from "react"
import { Clock, MapPin, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs, orderBy, Timestamp } from "firebase/firestore"
import type { AttendanceRecord } from "@/types/attendance"

interface AttendanceTableProps {
  records: AttendanceRecord[]
  onApprove: (recordId: string, notes?: string) => Promise<void>
  onReject: (recordId: string, notes?: string) => Promise<void>
  date: Date
}

export function AttendanceTable({ records, onApprove, onReject, date }: AttendanceTableProps) {
  const [loading, setLoading] = useState(false)

  if (loading) {
    return <div className="text-center py-4">Loading attendance data...</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Employee
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Check In
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Check Out
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Location
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {records.map((record) => (
            <tr key={record.id}>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="h-10 w-10 flex-shrink-0">
                    <img
                      className="h-10 w-10 rounded-full"
                      src={`/placeholder.svg?height=40&width=40`}
                      alt=""
                    />
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">
                      {record.employeeId}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    record.status === "present"
                      ? "bg-green-100 text-green-800"
                      : record.status === "late"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {record.status === "present" ? (
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                  ) : record.status === "late" ? (
                    <AlertCircle className="mr-1 h-3 w-3" />
                  ) : (
                    <XCircle className="mr-1 h-3 w-3" />
                  )}
                  {record.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center text-sm text-gray-900">
                  <Clock className="mr-1 h-4 w-4 text-gray-400" />
                  {record.checkIn.time.toLocaleTimeString()}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center text-sm text-gray-900">
                  <Clock className="mr-1 h-4 w-4 text-gray-400" />
                  {record.checkOut?.time.toLocaleTimeString() || "-"}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center text-sm text-gray-900">
                  <MapPin className="mr-1 h-4 w-4 text-gray-400" />
                  {record.checkIn.location ? 
                    `${record.checkIn.location.latitude.toFixed(4)}, ${record.checkIn.location.longitude.toFixed(4)}`
                    : 'No location data'
                  }
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
} 