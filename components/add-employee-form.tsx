"use client"

import type React from "react"
import { useState } from "react"
import { Upload, RefreshCw, Eye, EyeOff } from "lucide-react"
import { signUp } from "@/lib/firebase"
import type { Employee, Manager } from "@/types"

interface AddEmployeeFormProps {
  onSubmit: (data: Employee) => void
  managers: Manager[]
}

export function AddEmployeeForm({ onSubmit, managers }: AddEmployeeFormProps) {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [role, setRole] = useState<"admin" | "manager" | "employee">("employee")
  const [managerId, setManagerId] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const generatePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()"
    let generatedPassword = ""
    for (let i = 0; i < 12; i++) {
      generatedPassword += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setPassword(generatedPassword)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Create user account in Firebase
      await signUp(email, password, `${firstName} ${lastName}`, role)

      // Submit form data
      onSubmit({
        firstName,
        lastName,
        role,
        managerId,
        email,
        password,
        imagePreview,
      })

      // Reset form
      setFirstName("")
      setLastName("")
      setRole("employee")
      setManagerId("")
      setEmail("")
      setPassword("")
      setImagePreview(null)
    } catch (err: any) {
      console.error("Error creating employee:", err)

      // Handle Firebase auth errors with more user-friendly messages
      if (err.code === "auth/email-already-in-use") {
        setError("This email is already in use. Please use a different email address.")
      } else if (err.code === "auth/invalid-email") {
        setError("Please enter a valid email address.")
      } else if (err.code === "auth/weak-password") {
        setError("Password is too weak. Please use a stronger password.")
      } else {
        setError(err.message || "Failed to create employee account")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2 flex flex-col items-center">
          <div className="relative w-32 h-32 mb-4">
            {imagePreview ? (
              <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-gray-200">
                <img
                  src={imagePreview || "/placeholder.svg"}
                  alt="Employee preview"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-32 h-32 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center">
                <Upload size={32} className="text-gray-400" />
              </div>
            )}

            <label
              htmlFor="employee-image"
              className="absolute bottom-0 right-0 bg-blue-500 text-white p-2 rounded-full cursor-pointer hover:bg-blue-600"
            >
              <Upload size={16} />
            </label>
            <input type="file" id="employee-image" accept="image/*" onChange={handleImageChange} className="hidden" />
          </div>
          <p className="text-sm text-gray-500 mb-6">Upload employee photo</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            First Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Last Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Role/Position <span className="text-red-500">*</span>
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "manager" | "employee")}
            required
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="employee">Employee</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Manager</label>
          <select
            value={managerId}
            onChange={(e) => setManagerId(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select a manager</option>
            {managers.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.name}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Address <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Provisional Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-24"
            />
            <div className="absolute inset-y-0 right-0 flex items-center">
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
              <button
                type="button"
                onClick={generatePassword}
                className="flex items-center mr-2 text-blue-500 hover:text-blue-600"
              >
                <RefreshCw size={16} className="mr-1" />
                <span className="text-sm">Generate</span>
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">Employee will be prompted to change this password on first login</p>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">{error}</div>}

      <div className="flex justify-end space-x-4">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white font-medium rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Creating Account..." : "Add Employee"}
        </button>
      </div>
    </form>
  )
}

