'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useNewAuth } from '@/contexts/new-auth-context'
import { validateSignUpPassword } from '@/lib/password-validation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

export default function ChangePasswordPage() {
  const router = useRouter()
  const { user } = useNewAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const validateForm = () => {
    if (!currentPassword) {
      setError('Please enter your current password')
      return false
    }
    if (!newPassword) {
      setError('Please enter a new password')
      return false
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return false
    }
    const passwordError = validateSignUpPassword(newPassword)
    if (passwordError) {
      setError(passwordError)
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validateForm()) {
      return
    }

    if (!user) {
      setError('You must be logged in to change your password')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to change password')
      }

      // Redirect based on role
      if (user.role === 'admin') {
        router.push('/admin/dashboard')
      } else if (user.role === 'manager') {
        router.push('/manager/dashboard')
      } else {
        router.push('/dashboard')
      }
    } catch (error: any) {
      console.error('Error changing password:', error)
      setError(error.message || 'Failed to change password')
    } finally {
      setIsLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="container max-w-md mx-auto py-10">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You must be logged in to access this page.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container max-w-md mx-auto py-10">
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Change Password</h1>
          <p className="text-muted-foreground">
            Please enter your current password and choose a new password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Changing Password...' : 'Change Password'}
          </Button>
        </form>
      </div>
    </div>
  )
} 