import { EmployeeWellnessReport } from "@/components/employee-wellness-report"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { WellnessChart } from "@/components/wellness-chart"


export default function WellnessCheckInPage() {
  const departments = [
    { name: "Finance", score: 60, color: "bg-blue-500" },
    { name: "HR", score: 45, color: "bg-teal-500" },
    { name: "IT", score: 30, color: "bg-indigo-500" },
    { name: "Marketing", score: 70, color: "bg-blue-500" },
    { name: "Design", score: 85, color: "bg-teal-500" },
    { name: "Management", score: 50, color: "bg-indigo-500" },
  ]

  const employees = [
    {
      name: "George Clooney",
      position: "Strategist",
      avatar: "/placeholder.svg?height=40&width=40",
      score: 80,
      scoreColor: "bg-teal-500",
      metrics: [
        {
          name: "Fatigue and irritability",
          ratings: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          selectedRating: 2,
          color: "bg-yellow-500",
        },
        {
          name: "Quality of work",
          ratings: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          selectedRating: 8,
          color: "bg-teal-500",
        },
        {
          name: "Time management",
          ratings: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          selectedRating: 7,
          color: "bg-blue-500",
        },
        {
          name: "Abscences",
          ratings: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          selectedRating: 2,
          color: "bg-yellow-500",
        },
      ],
    },
    {
      name: "Miley Codus",
      position: "Frontend developer",
      avatar: "/placeholder.svg?height=40&width=40",
      score: 40,
      scoreColor: "bg-orange-500",
      metrics: [
        {
          name: "Fatigue and irritability",
          ratings: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          selectedRating: 3,
          color: "bg-yellow-500",
        },
        {
          name: "Quality of work",
          ratings: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          selectedRating: 4,
          color: "bg-orange-500",
        },
        {
          name: "Time management",
          ratings: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          selectedRating: 2,
          color: "bg-red-500",
        },
        {
          name: "Abscences",
          ratings: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          selectedRating: 3,
          color: "bg-yellow-500",
        },
      ],
    },
  ]

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activePath="/wellness-check-in" />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto p-4">
          <div className="max-w-7xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold">Wellness check-in</h1>
              <p className="text-gray-500">Here&apos;s your employee progress overview.</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
              <WellnessChart departments={departments} />
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-bold">Latest reports</h2>
            </div>

            <div className="bg-white rounded-lg border border-gray-200">
              {employees.map((employee, index) => (
                <EmployeeWellnessReport key={index} employee={employee} />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

