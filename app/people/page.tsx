import { EmployeeRow } from "@/components/employee-row"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { Filter, ChevronLeft, ChevronRight } from "lucide-react"

export default function PeoplePage() {
  const employees = [
    {
      name: "George Clooney",
      position: "Strategist",
      location: "Madrid, Spain",
      time: "14:45",
      department: "People & Culture",
      avatar: "/placeholder.svg?height=48&width=48",
    },
    {
      name: "Miley Codus",
      position: "Frontend developer",
      location: "Dublin, Ireland",
      time: "13:45",
      department: "IT",
      avatar: "/placeholder.svg?height=48&width=48",
    },
    {
      name: "Sara Buyer",
      position: "Social Media Specialist",
      location: "Copenhagen, Denmark",
      time: "14:45",
      department: "Marketing",
      avatar: "/placeholder.svg?height=48&width=48",
    },
    {
      name: "Louis Blues",
      position: "Senior Designer",
      location: "Dublin, Ireland",
      time: "13:45",
      department: "Design",
      avatar: "/placeholder.svg?height=48&width=48",
    },
    {
      name: "Josh Hopkins",
      position: "PR Manager",
      location: "Dublin, Ireland",
      time: "13:45",
      department: "Management",
      avatar: "/placeholder.svg?height=48&width=48",
    },
    {
      name: "Jozef Fedor",
      position: "Sales Manager",
      location: "London, UK",
      time: "13:45",
      department: "Finance",
      avatar: "/placeholder.svg?height=48&width=48",
    },
    {
      name: "Frederika Frederiksen",
      position: "CEO",
      location: "Berlin, Germany",
      time: "14:45",
      department: "People & Culture",
      avatar: "/placeholder.svg?height=48&width=48",
    },
  ]

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activePath="/people" />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto p-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-700">People</h1>
                <p className="text-gray-500">30 employees</p>
              </div>

              <button className="flex items-center px-3 py-2 bg-gray-100 rounded-md hover:bg-gray-200">
                <Filter size={16} className="mr-2" />
                <span>Filter</span>
              </button>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="divide-y divide-gray-200 text-gray-700">
                {employees.map((employee, index) => (
                  <EmployeeRow
                    key={index}
                    name={employee.name}
                    position={employee.position}
                    location={employee.location}
                    time={employee.time}
                    department={employee.department}
                    avatar={employee.avatar}
                  />
                ))}
              </div>

              <div className="p-4 flex justify-center">
                <div className="flex space-x-2">
                  <button className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100">
                    <ChevronLeft size={16} />
                  </button>
                  <button className="w-8 h-8 flex items-center justify-center rounded-md bg-blue-500 text-white">
                    1
                  </button>
                  <button className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100">2</button>
                  <button className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100">3</button>
                  <button className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

