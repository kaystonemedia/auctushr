interface EmployeeRowProps {
    name: string
    position: string
    location: string
    time: string
    department: string
    avatar: string
  }
  
  export function EmployeeRow({
    name,
    position,
    location,
    time,
    department,
    avatar = "/placeholder.svg?height=48&width=48",
  }: EmployeeRowProps) {
    // Function to determine department tag color
    const getDepartmentColor = (dept: string) => {
      if (dept === "Design") return "bg-teal-100 text-teal-800"
      if (dept === "Marketing") return "bg-blue-100 text-blue-800"
      if (dept === "IT") return "bg-indigo-100 text-indigo-800"
      if (dept === "Finance") return "bg-blue-100 text-blue-800"
      if (dept === "Management") return "bg-indigo-100 text-indigo-800"
      if (dept === "People & Culture") return "bg-teal-100 text-teal-800"
      return "bg-gray-100 text-gray-800"
    }
  
    return (
      <div className="py-4 border-b border-gray-200">
        <div className="flex items-center">
          <div className="flex-shrink-0 mr-4">
            <img src={avatar || "/placeholder.svg"} alt={name} className="w-12 h-12 rounded-full object-cover" />
          </div>
  
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">{name}</h4>
                <p className="text-sm text-gray-500">{position}</p>
              </div>
  
              <div className="text-right">
                <p className="text-sm text-gray-900">{location}</p>
                <p className="text-sm text-gray-500">{time}</p>
              </div>
            </div>
          </div>
  
          <div className="ml-4">
            <span className={`px-3 py-1 text-sm rounded-md ${getDepartmentColor(department)}`}>{department}</span>
          </div>
        </div>
      </div>
    )
  }
  
  