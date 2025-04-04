import { AttendanceRecord } from "@/types/attendance"
import { Clock, MapPin, User, AlertCircle } from "lucide-react"
import { useEffect, useState } from "react"

interface AttendanceMonitorProps {
  records: AttendanceRecord[]
  onApprove: (recordId: string) => void
  onReject: (recordId: string) => void
}

export function AttendanceMonitor({ records, onApprove, onReject }: AttendanceMonitorProps) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [activeEmployees, setActiveEmployees] = useState<AttendanceRecord[]>([])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const today = new Date().toDateString()
    const active = records.filter(record => {
      const recordDate = new Date(record.date).toDateString()
      return recordDate === today && record.checkIn && !record.checkOut
    })
    setActiveEmployees(active)
  }, [records])

  const formatTime = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return dateObj.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const calculateDuration = (checkIn: Date | string) => {
    const start = typeof checkIn === 'string' ? new Date(checkIn) : checkIn
    const diffMs = currentTime.getTime() - start.getTime()
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-900">Active Employees</h3>
        <div className="text-sm text-gray-500">
          {currentTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })}
        </div>
      </div>

      <div className="space-y-4">
        {activeEmployees.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No active employees at the moment
          </div>
        ) : (
          activeEmployees.map((record) => (
            <div key={record.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <User className="h-8 w-8 text-gray-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{record.employeeName}</p>
                  <p className="text-sm text-gray-500">{record.department}</p>
                </div>
              </div>

              <div className="flex items-center space-x-6">
                <div className="flex items-center">
                  <Clock className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-600">
                    {formatTime(record.checkIn.time)} - {calculateDuration(record.checkIn.time)}
                  </span>
                </div>

                {record.checkIn.location && (
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-600">
                      {record.checkIn.location.address || 'Location tracked'}
                    </span>
                  </div>
                )}

                {record.flags?.some(flag => flag.severity === 'high') && (
                  <div className="flex items-center text-red-600">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    <span className="text-sm">High Priority Flag</span>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onApprove(record.id)}
                    className="px-3 py-1 text-sm text-green-600 hover:bg-green-50 rounded-md"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => onReject(record.id)}
                    className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-md"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
} 