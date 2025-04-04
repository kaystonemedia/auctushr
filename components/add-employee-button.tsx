"use client"
import { UserPlus } from "lucide-react"

interface AddEmployeeButtonProps {
  onClick: () => void
  variant?: "primary" | "secondary"
  size?: "sm" | "md" | "lg"
}

export function AddEmployeeButton({ onClick, variant = "primary", size = "md" }: AddEmployeeButtonProps) {
  const baseClasses = "flex items-center rounded-md font-medium"

  const variantClasses = {
    primary: "bg-blue-500 text-white hover:bg-blue-600",
    secondary: "bg-gray-100 text-gray-800 hover:bg-gray-200",
  }

  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-2 text-sm",
    lg: "px-4 py-3 text-base",
  }

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 20,
  }

  return (
    <button onClick={onClick} className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]}`}>
      <UserPlus size={iconSizes[size]} className="mr-2" />
      <span>Add Employee</span>
    </button>
  )
}

