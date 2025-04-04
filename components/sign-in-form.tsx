"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn, checkUserExists } from '@/lib/firebase'
import { Logo } from './logo'
import Cookies from 'js-cookie'

export default function SignInForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'email' | 'password' | 'setup'>('email')
  const router = useRouter()

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const userExists = await checkUserExists(email)
      
      if (!userExists) {
        setError('No account found with this email. Please contact your administrator.')
        setLoading(false)
        return
      }

      console.log('User exists:', userExists)

      if (!userExists.hasPassword) {
        setStep('setup')
      } else {
        setStep('password')
      }
    } catch (error) {
      console.error('Error checking user:', error)
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
      
      // Force a hard navigation to ensure the auth state is properly updated
      window.location.href = '/'
    } catch (error) {
      console.error('Error signing in:', error)
      setError('Invalid password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    try {
      const user = await signIn(email, password, true)
      // Set auth token cookie
      Cookies.set('auth-token', user.uid, { expires: 7 }) // Cookie expires in 7 days
      
      // Force a hard navigation to ensure the auth state is properly updated
      window.location.href = '/'
    } catch (error) {
      console.error('Error setting up password:', error)
      setError('Failed to set up password. Please try again.')
    } finally {
      setLoading(false)
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
        <form className="mt-8 space-y-6" onSubmit={step === 'email' ? handleEmailSubmit : step === 'password' ? handlePasswordSubmit : handleSetupSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                disabled={step !== 'email'}
              />
            </div>
            {(step === 'password' || step === 'setup') && (
              <>
                <div>
                  <label htmlFor="password" className="sr-only">Password</label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                    placeholder="Password"
                  />
                </div>
                {step === 'setup' && (
                  <div>
                    <label htmlFor="confirm-password" className="sr-only">Confirm Password</label>
                    <input
                      id="confirm-password"
                      name="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                      placeholder="Confirm Password"
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                step === 'email' ? 'Continue' : step === 'password' ? 'Sign in' : 'Set up password'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

