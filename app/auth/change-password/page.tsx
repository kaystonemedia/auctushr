'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useNewAuth } from '@/contexts/new-auth-context'
import { updatePassword } from 'firebase/auth'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { validateSignUpPassword } from '@/lib/password-validation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

export default function ChangePasswordPage() {
  const router = useRouter()
  const { user, firebaseUser, login } = useNewAuth()
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

    if (!firebaseUser || !user) {
      setError('You must be logged in to change your password')
      return
    }

    setIsLoading(true)

    try {
      // First verify the current password by attempting to sign in
      await login(user.email, currentPassword, true)

      // Update the password
      await updatePassword(firebaseUser, newPassword)

      // Update Firestore to remove the password change requirement
      const collectionName = user.role === 'admin' ? 'users' : 'employees'
      await updateDoc(doc(db, collectionName, user.id), {
        requiresPasswordChange: false,
        updatedAt: new Date()
      })

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
      if (error.code === 'auth/wrong-password') {
        setError('Current password is incorrect')
      } else if (error.code === 'auth/requires-recent-login') {
        setError('Please sign out and sign in again before changing your password')
      } else {
        setError(error.message || 'Failed to change password')
      }
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