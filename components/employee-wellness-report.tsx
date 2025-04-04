import { ChevronDown } from "lucide-react"

interface EmployeeWellnessReportProps {
  employee: {
    name: string
    position: string
    avatar: string
    score: number
    scoreColor: string
    metrics: {
      name: string
      ratings: number[]
      selectedRating: number
      color: string
    }[]
  }
}

export function EmployeeWellnessReport({ employee }: EmployeeWellnessReportProps) {
  return (
    <div className="border-t border-gray-200 py-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <button className="mr-2 text-gray-400">
            <ChevronDown size={20} />
          </button>
          <img
            src={employee.avatar || "/placeholder.svg?height=40&width=40"}
            alt={employee.name}
            className="w-10 h-10 rounded-full mr-3"
          />
          <div>
            <h4 className="font-medium">{employee.name}</h4>
            <p className="text-sm text-gray-500">{employee.position}</p>
          </div>
        </div>

        <div className="flex items-center">
          <div className={`w-3 h-3 rounded-full ${employee.scoreColor} mr-1`}></div>
          <span className="font-medium">{employee.score}</span>
        </div>
      </div>

      <div className="space-y-4 pl-16">
        {employee.metrics.map((metric, index) => (
          <div key={index} className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm">{metric.name}</span>
            </div>
            <div className="flex space-x-2">
              {metric.ratings.map((rating) => (
                <button
                  key={rating}
                  className={`w-8 h-8 rounded-md text-sm flex items-center justify-center
                    ${
                      rating === metric.selectedRating ? `${metric.color} text-white` : "bg-gray-100 hover:bg-gray-200"
                    }`}
                >
                  {rating}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="mt-4">
          <div className="flex justify-between text-sm">
            <span>Comments:</span>
          </div>
          <p className="text-sm text-gray-500 italic">No comments</p>
        </div>
      </div>
    </div>
  )
}

