import { AttendanceRecord, AttendanceStats } from '@/types/attendance'
import { Clock, MapPin, AlertCircle, CheckCircle, XCircle } from 'lucide-react'

interface TeamAttendanceReportProps {
  records: AttendanceRecord[]
  stats: AttendanceStats
  onApprove: (recordId: string, notes?: string) => Promise<void>
  onReject: (recordId: string, notes: string) => Promise<void>
}

export function TeamAttendanceReport({ records, stats, onApprove, onReject }: TeamAttendanceReportProps) {
  if (!stats) {
    return (
      <div className="text-center py-8 text-gray-500">
        No attendance data available
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Team Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-500">Team Attendance Rate</h3>
            <Clock className="h-5 w-5 text-gray-400" />
          </div>
          <div className="text-2xl font-semibold text-gray-900">
            {stats.attendanceRate.toFixed(1)}%
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-500">Pending Approvals</h3>
            <AlertCircle className="h-5 w-5 text-yellow-500" />
          </div>
          <div className="text-2xl font-semibold text-gray-900">
            {stats.approvalStats?.pending || 0}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-500">Late Days</h3>
            <Clock className="h-5 w-5 text-yellow-500" />
          </div>
          <div className="text-2xl font-semibold text-gray-900">
            {stats.lateDays}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-500">Attendance Flags</h3>
            <AlertCircle className="h-5 w-5 text-red-500" />
          </div>
          <div className="text-2xl font-semibold text-gray-900">
            {stats.flags.count}
          </div>
        </div>
      </div>

      {/* Attendance Records Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
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
                  Flags
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Approval
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {records.map((record) => (
                <tr key={record.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {record.employeeName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {record.date.toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      record.status === 'present' ? 'bg-green-100 text-green-800' :
                      record.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                      record.status === 'absent' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      {record.checkIn.time.toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {record.checkOut ? (
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        {record.checkOut.time.toLocaleTimeString()}
                      </div>
                    ) : (
                      <span className="text-gray-400">Not checked out</span>
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {record.approvalStatus === 'pending' && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => onApprove(record.id)}
                          className="text-green-600 hover:text-green-900"
                        >
                          <CheckCircle className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => {
                            const notes = prompt('Please provide rejection reason:')
                            if (notes) onReject(record.id, notes)
                          }}
                          className="text-red-600 hover:text-red-900"
                        >
                          <XCircle className="h-5 w-5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
} 