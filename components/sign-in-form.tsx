"use client"

import { useState } from 'react'
import { useNewAuth } from '@/contexts/new-auth-context'
import { Logo } from './logo'
import { FirstTimePasswordChange } from './first-time-password-change'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'
import { checkUserExists } from '@/lib/firebase'

type SignInStep = 'email' | 'password' | 'setup'

export function SignInForm() {
  const { login, isLoading: authLoading } = useNewAuth()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<SignInStep>('email')

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        throw new Error('Please enter a valid email address')
      }

      // Check if user exists in Firestore
      console.log('Checking if user exists:', email)
      const userExists = await checkUserExists(email)
      console.log('User exists check result:', userExists)

      if (!userExists) {
        throw new Error('No account found with this email. Please contact your administrator.')
      }

      // If user exists but hasn't set up password, go to setup step
      if (!userExists.hasPassword) {
        console.log('First time login detected, moving to setup step')
        setStep('setup')
      } else {
        console.log('User exists, moving to password step')
        setStep('password')
      }
    } catch (error) {
      console.error('Email validation error:', error)
      if (error instanceof Error) {
        setError(error.message)
      } else {
        setError('An unexpected error occurred')
      }
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      console.log('Attempting login with email:', email)
      await login(email, password)
      console.log('Login successful, auth context will handle navigation')
    } catch (error) {
      console.error('Sign in error details:', error)
      
      if (error instanceof Error) {
        if (error.message === 'FIRST_TIME_LOGIN') {
          console.log('First time login detected, moving to setup step')
          setStep('setup')
        } else if (error.message === 'User profile not found') {
          console.log('No user profile found')
          setError('No account found with this email. Please contact your administrator.')
          setStep('email')
        } else if (error.message === 'Password has already been set for this account') {
          setError('This account has already been set up. Please use the regular login.')
          setStep('password')
        } else if (error.message.includes('auth/user-not-found') || error.message.includes('auth/wrong-password')) {
          setError('Invalid email or password')
          setStep('email')
        } else {
          console.log('Login error:', error.message)
          setError(error.message || 'Invalid password. Please try again.')
        }
      } else {
        console.error('Unexpected error type:', error)
        setError('An unexpected error occurred')
      }
    } finally {
      setLoading(false)
    }
  }

  // Show loading state from auth context
  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4">
        <Logo className="h-12 w-auto" />
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Logo className="mx-auto h-12 w-auto" />
        <h2 className="mt-6 text-3xl font-bold text-gray-900">
          {step === 'email' && 'Sign in to your account'}
          {step === 'password' && 'Enter your password'}
          {step === 'setup' && 'Set up your account'}
        </h2>
        {step === 'setup' && (
          <p className="mt-2 text-sm text-gray-600">
            Welcome! Please set up your password to access your account.
          </p>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {step === 'email' && (
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div>
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading || authLoading}
              autoComplete="email"
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={loading || authLoading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Continue'
            )}
          </Button>
        </form>
      )}

      {step === 'password' && (
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading || authLoading}
              autoComplete="current-password"
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={loading || authLoading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Sign in'
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => setStep('email')}
            disabled={loading || authLoading}
          >
            Back
          </Button>
        </form>
      )}

      {step === 'setup' && (
        <FirstTimePasswordChange
          email={email}
          onSuccess={() => {
            // After successful password setup, redirect to dashboard
            window.location.href = '/dashboard'
          }}
          onCancel={() => {
            setStep('email')
            setEmail('')
            setPassword('')
            setError('')
          }}
        />
      )}
    </div>
  )
}

