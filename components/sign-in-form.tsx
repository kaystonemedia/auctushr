"use client"

import { useState, useEffect } from 'react'
import { useNewAuth } from '@/contexts/new-auth-context'
import { useSearchParams } from 'next/navigation'
import { Logo } from './logo'
import { FirstTimePasswordChange } from './first-time-password-change'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

type SignInStep = 'email' | 'password' | 'setup'

export function SignInForm() {
  const { login, isLoading: authLoading, user } = useNewAuth()
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get('invite') || undefined

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<SignInStep>('email')
  const [isElectronAuth, setIsElectronAuth] = useState(false)

  // Check if this is an Electron authentication request
  useEffect(() => {
    const electronParam = searchParams.get('electron')
    const callbackParam = searchParams.get('callback')
    
    if (electronParam === 'true' && callbackParam) {
      setIsElectronAuth(true)
    }
  }, [searchParams])

  // Handle successful authentication for Electron
  useEffect(() => {
    if (isElectronAuth && user && !authLoading) {
      console.log('Electron auth detected with user:', user.email)
      handleElectronCallback()
    }
  }, [isElectronAuth, user, authLoading])

  // Also check on component mount if user is already authenticated
  useEffect(() => {
    if (isElectronAuth && user && !authLoading) {
      console.log('User already authenticated, triggering Electron callback')
      // Add a small delay to ensure the page is fully loaded
      setTimeout(() => {
        handleElectronCallback()
      }, 1000)
    }
  }, [isElectronAuth]) // Only run on mount and when isElectronAuth changes

  const handleElectronCallback = async () => {
    try {
      console.log('handleElectronCallback called')
      const callback = searchParams.get('callback')
      const state = searchParams.get('state')
      
      console.log('Callback params:', { callback, state, user: user?.email })
      
      if (!callback) {
        console.error('No callback URL found')
        setError('Missing callback URL for Electron authentication')
        return
      }
      
      if (!user) {
        console.error('No user found for Electron callback')
        setError('User not authenticated')
        return
      }

      let callbackUrl = `/api/auth/electron-callback?state=${encodeURIComponent(state || '')}`
      try {
        const tokenResponse = await fetch('/api/auth/token', { cache: 'no-store' })
        if (tokenResponse.ok) {
          const { token } = await tokenResponse.json()
          if (token) {
            callbackUrl += `&token=${encodeURIComponent(token)}`
          }
        }
      } catch (tokenError) {
        console.warn('Could not attach Supabase token to Electron callback:', tokenError)
      }
      console.log('Redirecting to Electron callback')
      
      // Show user feedback
      setError('') // Clear any existing errors
      // Update UI to show we're processing
      const messageDiv = document.createElement('div')
      messageDiv.innerHTML = `
        <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                    background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    z-index: 9999; text-align: center;">
          <div style="font-size: 18px; margin-bottom: 10px;">🔄 Authenticating with Desktop App...</div>
          <div style="color: #666;">Please wait while we redirect you back to the app.</div>
        </div>
      `
      document.body.appendChild(messageDiv)
      
      // Redirect after showing the message
      setTimeout(() => {
        window.location.href = callbackUrl
      }, 500)
      
    } catch (error: unknown) {
      console.error('Electron callback error:', error)
      const message = error instanceof Error ? error.message : 'Unknown error'
      setError(`Authentication failed: ${message}. Please try again.`)
    }
  }

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

      const preflightResponse = await fetch(`/api/auth/preflight?email=${encodeURIComponent(email)}`, {
        cache: 'no-store'
      })
      const preflight = await preflightResponse.json()
      if (!preflightResponse.ok) {
        throw new Error(preflight.error || 'Failed to verify account')
      }
      if (!preflight.exists) {
        throw new Error('No account found with this email. Please contact your administrator.')
      }

      if (preflight.needsPasswordSetup || !preflight.hasPassword || !preflight.hasAuthUser) {
        if (preflight.requiresInviteLink && !inviteToken) {
          throw new Error('Please open the link in your invite email to create your password. If you cannot find it, ask your administrator to resend the invite.')
        }
        setStep('setup')
        if (preflight.isMigrated) {
          setError('Welcome back. Please choose a new password to finish moving your account to our new system.')
        }
      } else {
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
        } else if (error.message === 'ACCOUNT_NOT_INITIALIZED') {
          setError('Your account needs initialization. Please set up your password to continue.')
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
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isElectronAuth && (
        <Alert>
          <AlertDescription>
            🖥️ Authenticating for Auctushr Desktop App...
          </AlertDescription>
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
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading || authLoading}
              autoComplete="current-password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
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
          inviteToken={inviteToken}
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

