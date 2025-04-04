"use client"

import type React from "react"

import { useState } from "react"
import { Logo } from "./logo"
import { signUp } from "@/lib/firebase"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"

export function SignUpForm() {
  const router = useRouter()
  const { isOnline } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [role, setRole] = useState<"admin" | "manager" | "employee">("employee")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const validateForm = () => {
    if (!name.trim()) {
      setError("Please enter your full name")
      return false
    }
    if (!email.trim()) {
      setError("Please enter your email")
      return false
    }
    if (!validateEmail(email)) {
      setError("Please enter a valid email address")
      return false
    }
    if (!password) {
      setError("Please enter a password")
      return false
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long")
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess(false)

    if (!validateForm()) {
      return
    }

    if (!isOnline) {
      setError("You are currently offline. Please check your internet connection and try again.")
      return
    }

    setLoading(true)

    try {
      console.log("Attempting to sign up with:", email, name, role)
      await signUp(email.trim(), password, name.trim(), role)
      console.log("Sign up successful")
      setSuccess(true)

      // Wait a moment to show the success message before redirecting
      setTimeout(() => {
        router.push("/auth/sign-in")
      }, 1500)
    } catch (err: any) {
      console.error("Sign up error:", err)
      if (err.code === "auth/email-already-in-use") {
        setError("This email is already registered. Please sign in instead.")
      } else if (err.code === "auth/invalid-email") {
        setError("Please enter a valid email address")
      } else if (err.code === "auth/weak-password") {
        setError("Password is too weak. Please use a stronger password.")
      } else if (err.message) {
        setError(err.message)
      } else {
        setError("Failed to sign up. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left sidebar */}
      <div className="w-1/3 bg-[#0f172a] text-white p-8 flex flex-col">
        <div className="mb-16">
          <Logo />
        </div>
      </div>

      {/* Right content */}
      <div className="w-2/3 p-8 flex items-center justify-center">
        <div className="w-full max-w-md">
          {!isOnline && (
            <div className="mb-4 p-3 text-sm text-yellow-800 bg-yellow-50 rounded-md">
              You are currently offline. Please check your internet connection.
            </div>
          )}

          <div className="text-right mb-8">
            <p className="text-gray-600">
              Already have an account?{" "}
              <a href="/auth/sign-in" className="font-semibold text-gray-900">
                Sign in
              </a>
              .
            </p>
          </div>

          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-4">Create an account</h1>
          </div>

          {error && <div className="mb-4 p-3 text-sm text-red-500 bg-red-50 rounded-md">{error}</div>}

          {success && (
            <div className="mb-4 p-3 text-sm text-green-500 bg-green-50 rounded-md">
              Account created successfully! Redirecting to sign in...
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
                disabled={loading || success || !isOnline}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
                disabled={loading || success || !isOnline}
                placeholder="example@domain.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
                disabled={loading || success || !isOnline}
                minLength={6}
                placeholder="At least 6 characters"
              />
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                Role
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as "admin" | "manager" | "employee")}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                disabled={loading || success || !isOnline}
              >
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading || success || !isOnline}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? "Creating account..." : success ? "Account created!" : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

