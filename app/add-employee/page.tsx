"use client"

import { useState } from "react"
import { AddEmployeeModal } from "@/components/add-employee-modal"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { Plus } from "lucide-react"
import type { Employee, Manager } from "@/types"

export default function AddEmployeePage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])

  // Mock managers data - replace with actual data from your backend
  const managers: Manager[] = [
    { id: "1", name: "John Doe" },
    { id: "2", name: "Jane Smith" },
    { id: "3", name: "Mike Johnson" },
  ]

  const handleAddEmployee = async (data: Employee) => {
    try {
      // Here you would typically make an API call to save the employee data
      console.log("New employee data:", data)
      setEmployees([...employees, data])
    } catch (error) {
      console.error("Error adding employee:", error)
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activePath="/add-employee" />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto p-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-500">Add New Employee</h1>
                <p className="text-gray-500">Create a new employee account and assign their role.</p>
              </div>

              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                <Plus size={20} className="mr-2" />
                <span>Add Employee</span>
              </button>
            </div>

            {/* Employee list will go here */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-gray-500 text-center">No employees added yet. Click the button above to add one.</p>
            </div>
          </div>
        </main>
      </div>

      <AddEmployeeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddEmployee}
        managers={managers}
      />
    </div>
  )
}

