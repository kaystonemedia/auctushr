import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"

interface CalendarViewProps {
  month: string
  days: number[]
  employees: {
    name: string
    position: string
    avatar: string
    absences: {
      type: "Away" | "Public Holiday"
      startDay: number
      endDay: number
    }[]
  }[]
}

export function CalendarView({ month, days, employees }: CalendarViewProps) {
  const currentDay = 16 // Assuming day 16 is the current day

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-700">{month}</h2>
          <div className="flex space-x-1">
            <button className="p-1 rounded-md hover:bg-gray-100">
              <ChevronLeft size={20} />
            </button>
            {days.map((day) => (
              <button
                key={day}
                className={`w-8 h-8 flex items-center justify-center rounded-md text-sm
                  ${day === currentDay ? "bg-blue-500 text-white" : "hover:bg-gray-100"}`}
              >
                {day}
              </button>
            ))}
            <button className="p-1 rounded-md hover:bg-gray-100">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-4 mt-4">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-rose-200 mr-2"></div>
            <span className="text-sm text-gray-600">Away</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-indigo-200 mr-2"></div>
            <span className="text-sm text-gray-600">Public Holiday</span>
          </div>
          <button className="ml-auto flex items-center text-sm text-blue-600">
            <Calendar size={16} className="mr-1" />
            <span>Add to calendar</span>
          </button>
          <button className="flex items-center text-sm text-gray-600">
            <span>Filter</span>
          </button>
        </div>
      </div>

      <div className="divide-y divide-gray-200">
        {employees.map((employee, index) => (
          <div key={index} className="flex p-4">
            <div className="flex-shrink-0 w-10 mr-4">
              <img
                src={employee.avatar || "/placeholder.svg?height=40&width=40"}
                alt={employee.name}
                className="w-10 h-10 rounded-full object-cover"
              />
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="text-sm font-medium text-gray-700">{employee.name}</h4>
                  <p className="text-xs text-gray-500">{employee.position}</p>
                </div>
              </div>

              <div className="relative h-8">
                {employee.absences.map((absence, i) => {
                  const startPosition = `${(absence.startDay - days[0]) * (100 / days.length)}%`
                  const width = `${(absence.endDay - absence.startDay + 1) * (100 / days.length)}%`

                  return (
                    <div
                      key={i}
                      className={`absolute h-8 rounded-md flex items-center justify-center text-xs
                        ${absence.type === "Away" ? "bg-rose-200" : "bg-indigo-200"}`}
                      style={{
                        left: startPosition,
                        width: width,
                      }}
                    >
                      {absence.type}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-gray-200 flex justify-center">
        <div className="flex space-x-2">
          <button className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100">
            <ChevronLeft size={16} />
          </button>
          <button className="w-8 h-8 flex items-center justify-center rounded-md bg-blue-500 text-white">1</button>
          <button className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100">2</button>
          <button className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100">3</button>
          <button className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

