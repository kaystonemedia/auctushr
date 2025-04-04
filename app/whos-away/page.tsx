import { CalendarView } from "@/components/calendar-view"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { Filter, Calendar } from "lucide-react"

type AbsenceType = "Away" | "Public Holiday"

interface Employee {
  name: string
  position: string
  avatar: string
  absences: {
    type: AbsenceType
    startDay: number
    endDay: number
  }[]
}

export default function WhosAwayPage() {
  const days = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31]

  const employees: Employee[] = [
    {
      name: "George Clooney",
      position: "Strategist",
      avatar: "/placeholder.svg?height=40&width=40",
      absences: [{ type: "Away", startDay: 16, endDay: 22 }],
    },
    {
      name: "Miley Codus",
      position: "Frontend developer",
      avatar: "/placeholder.svg?height=40&width=40",
      absences: [{ type: "Public Holiday", startDay: 20, endDay: 20 }],
    },
    {
      name: "Sara Buyer",
      position: "Social Media Specialist",
      avatar: "/placeholder.svg?height=40&width=40",
      absences: [{ type: "Away", startDay: 20, endDay: 24 }],
    },
    {
      name: "Louis Blues",
      position: "Senior Designer",
      avatar: "/placeholder.svg?height=40&width=40",
      absences: [
        { type: "Public Holiday", startDay: 20, endDay: 20 },
        { type: "Away", startDay: 21, endDay: 22 },
      ],
    },
    {
      name: "Josh Hopkins",
      position: "PR Manager",
      avatar: "/placeholder.svg?height=40&width=40",
      absences: [{ type: "Public Holiday", startDay: 20, endDay: 20 }],
    },
    {
      name: "Jozef Fedor",
      position: "Sales Manager",
      avatar: "/placeholder.svg?height=40&width=40",
      absences: [
        { type: "Away", startDay: 16, endDay: 17 },
        { type: "Away", startDay: 28, endDay: 30 },
      ],
    },
    {
      name: "Frederika Frederiksen",
      position: "CEO",
      avatar: "/placeholder.svg?height=40&width=40",
      absences: [{ type: "Away", startDay: 30, endDay: 31 }],
    },
  ]

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activePath="/whos-away" />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto p-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-700">Who&apos;s away</h1>
                <p className="text-gray-500">7 people away this month</p>
              </div>

              <div className="flex space-x-4">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-rose-200 mr-2"></div>
                    <span className="text-sm text-gray-600">Away</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-indigo-200 mr-2"></div>
                    <span className="text-sm text-gray-600">Public Holiday</span>
                  </div>
                </div>

                <button className="flex items-center px-3 py-2 bg-gray-100 rounded-md hover:bg-gray-200">
                  <Calendar size={16} className="mr-2" />
                  <span>Add to calendar</span>
                </button>

                <button className="flex items-center px-3 py-2 bg-gray-100 rounded-md hover:bg-gray-200">
                  <Filter size={16} className="mr-2" />
                  <span>Filter</span>
                </button>
              </div>
            </div>

            <CalendarView month="December" days={days} employees={employees} />
          </div>
        </main>
      </div>
    </div>
  )
}

