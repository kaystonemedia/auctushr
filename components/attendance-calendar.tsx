import { AttendanceRecord } from "@/types/attendance"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useState } from "react"

interface AttendanceCalendarProps {
  records: AttendanceRecord[]
  onDateSelect: (date: Date) => void
}

export function AttendanceCalendar({ records, onDateSelect }: AttendanceCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const getAttendanceForDate = (date: Date) => {
    return records.find(record => {
      const recordDate = new Date(record.date)
      return recordDate.toDateString() === date.toDateString()
    })
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'present':
        return 'bg-green-100 text-green-800'
      case 'late':
        return 'bg-yellow-100 text-yellow-800'
      case 'absent':
        return 'bg-red-100 text-red-800'
      case 'half_day':
        return 'bg-orange-100 text-orange-800'
      case 'early_leave':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
  }

  const handleDateClick = (date: Date) => {
    onDateSelect(date)
  }

  const daysInMonth = getDaysInMonth(currentDate)
  const firstDayOfMonth = getFirstDayOfMonth(currentDate)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-900">{monthName}</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrevMonth}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <ChevronLeft className="h-5 w-5 text-gray-500" />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <ChevronRight className="h-5 w-5 text-gray-500" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
            {day}
          </div>
        ))}

        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
          <div key={`empty-${i}`} className="h-24" />
        ))}

        {days.map(day => {
          const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
          const attendance = getAttendanceForDate(date)
          const isToday = date.toDateString() === new Date().toDateString()

          return (
            <button
              key={day}
              onClick={() => handleDateClick(date)}
              className={`h-24 p-2 text-left border rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500
                ${isToday ? 'border-blue-500' : 'border-gray-200'}`}
            >
              <div className="text-sm font-medium mb-1">{day}</div>
              {attendance && (
                <div className={`text-xs px-2 py-1 rounded-full inline-block ${getStatusColor(attendance.status)}`}>
                  {attendance.status.replace('_', ' ')}
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-green-100 rounded-full mr-2"></div>
          <span className="text-sm text-gray-600">Present</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-yellow-100 rounded-full mr-2"></div>
          <span className="text-sm text-gray-600">Late</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-red-100 rounded-full mr-2"></div>
          <span className="text-sm text-gray-600">Absent</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-orange-100 rounded-full mr-2"></div>
          <span className="text-sm text-gray-600">Half Day</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-purple-100 rounded-full mr-2"></div>
          <span className="text-sm text-gray-600">Early Leave</span>
        </div>
      </div>
    </div>
  )
} 