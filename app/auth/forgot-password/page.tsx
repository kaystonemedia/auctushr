"use client"

import { useState } from 'react'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { Logo } from '@/components/logo'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    setSuccess(false)

    try {
      await sendPasswordResetEmail(auth, email)
      setSuccess(true)
    } catch (error: any) {
      console.error('Error sending password reset:', error)
      if (error.code === 'auth/user-not-found') {
        setError('No account found with this email address.')
      } else {
        setError('An error occurred. Please try again.')
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
          <div className="text-right mb-8">
            <p className="text-gray-600">
              Remember your password?{" "}
              <a href="/auth/sign-in" className="font-semibold text-gray-900">
                Sign in
              </a>
              .
            </p>
          </div>

          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-4">Reset your password</h1>
            <p className="text-gray-600">
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 text-sm text-red-500 bg-red-50 rounded-md">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 text-sm text-green-500 bg-green-50 rounded-md">
              Password reset email sent! Please check your inbox.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="example@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
} 