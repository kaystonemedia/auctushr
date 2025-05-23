"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from '@/lib/firebase'
import { Logo } from './logo'
import Cookies from 'js-cookie'
import { FirstTimePasswordChange } from './first-time-password-change'

interface SignInError extends Error {
  message: string;
  code?: string;
}

export default function SignInForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'email' | 'password' | 'setup'>('email')
  const router = useRouter()

  const getRoleBasedRedirect = () => {
    // All roles now use the unified dashboard
    return '/dashboard'
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Just move to password step - we'll check everything during actual sign in
      setStep('password')
    } catch (error) {
      console.error('Error:', error)
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const user = await signIn(email, password)
      // Set auth token cookie
      Cookies.set('auth-token', user.uid, { expires: 7 }) // Cookie expires in 7 days
      
      // Redirect to dashboard
      router.push(getRoleBasedRedirect())
    } catch (error) {
      console.error('Error signing in:', error)
      const signInError = error as SignInError
      if (signInError.message === "FIRST_TIME_LOGIN") {
        setStep('setup')
      } else if (signInError.message === "No account found with this email. Please contact your administrator.") {
        setError(signInError.message)
        setStep('email')
      } else {
        setError(signInError.message || 'Invalid password. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordSetupSuccess = async (userId: string) => {
    try {
      // Set auth token cookie
      Cookies.set('auth-token', userId, { expires: 7 })
      
      // Redirect to dashboard
      router.push(getRoleBasedRedirect())
    } catch (error) {
      console.error('Error after password setup:', error)
      setError('An error occurred after setting up your password. Please try signing in again.')
      setStep('email')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <Logo className="mx-auto h-12 w-auto" />
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {step === 'email' && 'Sign in to your account'}
            {step === 'password' && 'Enter your password'}
            {step === 'setup' && 'Set up your password'}
          </h2>
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}
        
        {step === 'email' && (
          <form onSubmit={handleEmailSubmit} className="mt-8 space-y-6">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                disabled={loading}
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Checking...' : 'Continue'}
              </button>
            </div>
          </form>
        )}

        {step === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="mt-8 space-y-6">
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                disabled={loading}
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>
        )}

        {step === 'setup' && (
          <FirstTimePasswordChange 
            email={email}
            onSuccess={handlePasswordSetupSuccess}
            onError={(errorMessage) => {
              setError(errorMessage)
              // Don't change the step, let the user try again
            }}
          />
        )}
      </div>
    </div>
  )
}

