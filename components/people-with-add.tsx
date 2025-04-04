"use client"

import { useState } from "react"


import { Filter, ChevronLeft, ChevronRight, UserPlus } from "lucide-react"
import { Sidebar } from "./sidebar"
import { Header } from "./header"
import { EmployeeRow } from "./employee-row"
import { AddEmployeeModal } from "./add-employee-modal"

export default function PeopleWithAddPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

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

  // Sample managers for the dropdown
  const managers = [
    {
      id: "1",
      name: "Frederika Frederiksen",
      position: "CEO",
      department: "People & Culture",
      avatar: "/placeholder.svg?height=48&width=48",
    },
    {
      id: "2",
      name: "Josh Hopkins",
      position: "PR Manager",
      department: "Management",
      avatar: "/placeholder.svg?height=48&width=48",
    },
    {
      id: "3",
      name: "Jozef Fedor",
      position: "Sales Manager",
      department: "Finance",
      avatar: "/placeholder.svg?height=48&width=48",
    },
  ]

  const handleAddEmployee = (employeeData: any) => {
    console.log("New employee data:", employeeData)
    // Here you would typically send this data to your API
    // and then update the employees list with the new employee
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activePath="/people" />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto p-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold">People</h1>
                <p className="text-gray-500">30 employees</p>
              </div>

              <div className="flex space-x-3">
                <button className="flex items-center px-3 py-2 bg-gray-100 rounded-md hover:bg-gray-200">
                  <Filter size={16} className="mr-2" />
                  <span>Filter</span>
                </button>

                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex items-center px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  <UserPlus size={16} className="mr-2" />
                  <span>Add Employee</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="divide-y divide-gray-200">
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

      <AddEmployeeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddEmployee}
        managers={managers}
      />
    </div>
  )
}

