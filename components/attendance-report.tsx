import { AttendanceRecord, AttendanceStats } from "@/types/attendance"
import { Clock, AlertCircle, MapPin, CheckCircle, XCircle, User } from "lucide-react"

interface AttendanceReportProps {
  records: AttendanceRecord[]
  stats: AttendanceStats
  onApprove?: (recordId: string, notes?: string) => Promise<void>
  onReject?: (recordId: string, notes?: string) => Promise<void>
}

type DateInput = Date | string | { toDate: () => Date }

export function AttendanceReport({ records, stats, onApprove, onReject }: AttendanceReportProps) {
  const formatDate = (date: DateInput) => {
    try {
      const dateObj = date instanceof Date ? date : 
                     typeof date === 'string' ? new Date(date) :
                     date.toDate()
      if (isNaN(dateObj.getTime())) {
        console.error('Invalid date:', date)
        return 'Invalid Date'
      }
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch (error) {
      console.error('Error formatting date:', error)
      return 'Invalid Date'
    }
  }

  const formatTime = (date: DateInput) => {
    try {
      const dateObj = date instanceof Date ? date : 
                     typeof date === 'string' ? new Date(date) :
                     date.toDate()
      if (isNaN(dateObj.getTime())) {
        console.error('Invalid date:', date)
        return 'Invalid Time'
      }
      return dateObj.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch (error) {
      console.error('Error formatting time:', error)
      return 'Invalid Time'
    }
  }

  const calculateHours = (checkIn: DateInput, checkOut: DateInput) => {
    try {
      const start = checkIn instanceof Date ? checkIn : 
                   typeof checkIn === 'string' ? new Date(checkIn) :
                   checkIn.toDate()
      const end = checkOut instanceof Date ? checkOut : 
                 typeof checkOut === 'string' ? new Date(checkOut) :
                 checkOut.toDate()
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return 'Invalid Hours'
      }

      const diffMs = end.getTime() - start.getTime()
      const hours = diffMs / (1000 * 60 * 60)
      return hours.toFixed(1)
    } catch (error) {
      console.error('Error calculating hours:', error)
      return 'Invalid Hours'
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-500">Total Days</h4>
            <User className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-2xl font-semibold text-gray-900">{stats.totalDays}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-500">Present Days</h4>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </div>
          <p className="text-2xl font-semibold text-gray-900">{stats.presentDays}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-500">Late Days</h4>
            <Clock className="h-5 w-5 text-yellow-500" />
          </div>
          <p className="text-2xl font-semibold text-gray-900">{stats.lateDays}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-500">Absent Days</h4>
            <XCircle className="h-5 w-5 text-red-500" />
          </div>
          <p className="text-2xl font-semibold text-gray-900">{stats.absentDays}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-500">Attendance Rate</h4>
            <AlertCircle className="h-5 w-5 text-blue-500" />
          </div>
          <p className="text-2xl font-semibold text-gray-900">{stats.attendanceRate.toFixed(1)}%</p>
        </div>
      </div>

      {/* Attendance Records Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Attendance Records</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
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
                  Hours
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Flags
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Approval
                </th>
                {onApprove && onReject && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {records.map((record) => (
                <tr key={record.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(record.date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      record.status === 'present' ? 'bg-green-100 text-green-800' :
                      record.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                      record.status === 'absent' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {(record.status || 'unknown').charAt(0).toUpperCase() + (record.status || 'unknown').slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      {formatTime(record.checkIn?.time || new Date())}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {record.checkOut ? (
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        {formatTime(record.checkOut.time)}
                      </div>
                    ) : (
                      <span className="text-gray-400">Not checked out</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {record.checkOut ? (
                      <span>{calculateHours(record.checkIn?.time || new Date(), record.checkOut.time)} hrs</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {record.checkIn?.location && (
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 mr-1" />
                        <span>Location recorded</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {record.flags && record.flags.length > 0 ? (
                      <div className="flex items-center">
                        <AlertCircle className="h-4 w-4 text-red-500 mr-1" />
                        <span>{record.flags.length} flags</span>
                      </div>
                    ) : (
                      <span className="text-gray-400">No flags</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      record.approvalStatus === 'approved' ? 'bg-green-100 text-green-800' :
                      record.approvalStatus === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {(record.approvalStatus || 'pending').charAt(0).toUpperCase() + (record.approvalStatus || 'pending').slice(1)}
                    </span>
                  </td>
                  {onApprove && onReject && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.approvalStatus === 'pending' && (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => onApprove(record.id)}
                            className="text-green-600 hover:text-green-900"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => onReject(record.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Flags and Notes */}
      {records.some(record => record.flags && record.flags.length > 0) && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              Attendance Flags
            </h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
            <div className="space-y-4">
              {records.map((record, index) => (
                record.flags?.map((flag, flagIndex) => (
                  <div key={`${index}-${flagIndex}`} className="flex items-start">
                    <div className={`flex-shrink-0 h-5 w-5 rounded-full mt-1
                      ${flag.severity === 'high' ? 'bg-red-500' : ''}
                      ${flag.severity === 'medium' ? 'bg-yellow-500' : ''}
                      ${flag.severity === 'low' ? 'bg-green-500' : ''}`}
                    />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">
                        {formatDate(record.date)} - {(flag.type || '').replace('_', ' ')}
                      </p>
                      <p className="text-sm text-gray-500">{flag.description || 'No description'}</p>
                    </div>
                  </div>
                ))
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 