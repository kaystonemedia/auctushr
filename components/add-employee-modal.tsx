"use client"

import { AddEmployeeForm } from "./add-employee-form"
import { X } from "lucide-react"
import type { Employee, Manager } from "@/types"

interface AddEmployeeModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: Employee) => void
  managers: Manager[]
}

export function AddEmployeeModal({ isOpen, onClose, onSubmit, managers }: AddEmployeeModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Add New Employee</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        <AddEmployeeForm
          onSubmit={(data) => {
            onSubmit(data)
            onClose()
          }}
          managers={managers}
        />
      </div>
    </div>
  )
}

