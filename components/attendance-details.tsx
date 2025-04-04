import { AttendanceRecord } from "@/types/attendance"
import { Clock, MapPin, AlertCircle, CheckCircle, XCircle, User } from "lucide-react"

interface AttendanceDetailsProps {
  date: Date
  records: AttendanceRecord[]
  onApprove?: (recordId: string, notes?: string) => Promise<void>
  onReject?: (recordId: string, notes?: string) => Promise<void>
}

export function AttendanceDetails({ date, records, onApprove, onReject }: AttendanceDetailsProps) {
  const dateRecords = records.filter(record => {
    const recordDate = new Date(record.date)
    return recordDate.getTime() === date.getTime()
  })

  const stats = {
    total: dateRecords.length,
    present: dateRecords.filter(r => r.status === 'present').length,
    late: dateRecords.filter(r => r.status === 'late').length,
    absent: dateRecords.filter(r => r.status === 'absent').length,
    pendingApprovals: dateRecords.filter(r => r.approvalStatus === 'pending').length
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-500">Total Employees</h4>
            <User className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-500">Present</h4>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </div>
          <p className="text-2xl font-semibold text-gray-900">{stats.present}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-500">Late</h4>
            <Clock className="h-5 w-5 text-yellow-500" />
          </div>
          <p className="text-2xl font-semibold text-gray-900">{stats.late}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-500">Absent</h4>
            <XCircle className="h-5 w-5 text-red-500" />
          </div>
          <p className="text-2xl font-semibold text-gray-900">{stats.absent}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-500">Pending Approvals</h4>
            <AlertCircle className="h-5 w-5 text-yellow-500" />
          </div>
          <p className="text-2xl font-semibold text-gray-900">{stats.pendingApprovals}</p>
        </div>
      </div>

      {/* Detailed Records */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Employee Records</h3>
        </div>
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
              {dateRecords.map((record) => (
                <tr key={record.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{record.employeeName}</div>
                    <div className="text-sm text-gray-500">{record.department}</div>
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
                    {record.checkIn.location && (
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
                      {record.approvalStatus.charAt(0).toUpperCase() + record.approvalStatus.slice(1)}
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
    </div>
  )
} 