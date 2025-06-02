'use client'

import { useState, useEffect, useRef } from 'react'
import { useNewAuth } from '@/contexts/new-auth-context'
import { User, Mail, Building, Calendar, Shield, Camera, Lock, Check, X } from 'lucide-react'
import { doc, updateDoc } from 'firebase/firestore'
import { updatePassword } from 'firebase/auth'
import { db, auth } from '@/lib/firebase'
import { uploadFile } from '@/lib/storage'
import { checkPasswordStrength, validatePassword, PASSWORD_REQUIREMENTS, PASSWORD_HINTS, type PasswordStrength } from '@/lib/password-validation'

// ... rest of the imports ...

export default function ProfilePage() {
  // ... existing state ...

  const { user } = useNewAuth()

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      if (!isOnline) {
        throw new Error('You are currently offline. Please check your internet connection.')
      }

      if (newPassword !== confirmPassword) {
        throw new Error('New passwords do not match')
      }

      // Validate password strength
      const passwordError = validatePassword(newPassword)
      if (passwordError) {
        throw new Error(passwordError)
      }

      // Update password
      await updatePassword(auth.currentUser!, newPassword)

      setSuccess(true)
      setIsChangingPassword(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordStrength({
        score: 0,
        requirements: {
          minLength: false,
          hasUpperCase: false,
          hasLowerCase: false,
          hasNumber: false,
          hasSpecialChar: false
        }
      })
    } catch (err) {
      console.error('Error changing password:', err)
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to change password')
      }
    } finally {
      setLoading(false)
    }
  }

  // ... rest of the component ...

  return (
    // ... existing JSX ...
    {isChangingPassword && (
      <div className="pt-6 border-t border-gray-200">
        <h4 className="text-lg font-medium text-gray-900 mb-4">Change Password</h4>
        <div className="space-y-4">
          {/* ... existing password fields ... */}
          
          {/* Password Strength Indicator */}
          <div className="mt-2">
            <div className="text-sm text-gray-600 mb-2">Password Strength:</div>
            <div className="h-2 bg-gray-200 rounded-full">
              <div
                className={`h-full rounded-full transition-all ${
                  passwordStrength.score === 0
                    ? 'w-0'
                    : passwordStrength.score === 1
                    ? 'w-1/4 bg-red-500'
                    : passwordStrength.score === 2
                    ? 'w-2/4 bg-yellow-500'
                    : passwordStrength.score === 3
                    ? 'w-3/4 bg-blue-500'
                    : 'w-full bg-green-500'
                }`}
              />
            </div>
            <div className="mt-2 space-y-1">
              {Object.entries(passwordStrength.requirements).map(([key, met]) => (
                <div key={key} className="flex items-center text-sm">
                  {met ? (
                    <Check className="w-4 h-4 text-green-500 mr-2" />
                  ) : (
                    <X className="w-4 h-4 text-red-500 mr-2" />
                  )}
                  <span className={met ? 'text-green-600' : 'text-red-600'}>
                    {key === 'minLength'
                      ? `At least ${PASSWORD_REQUIREMENTS.minLength} characters`
                      : key === 'hasUpperCase'
                      ? 'One uppercase letter'
                      : key === 'hasLowerCase'
                      ? 'One lowercase letter'
                      : key === 'hasNumber'
                      ? 'One number'
                      : 'One special character'}
                  </span>
                </div>
              ))}
            </div>
            {passwordStrength.score < 5 && (
              <div className="mt-2 text-sm text-gray-500">
                <p className="font-medium mb-1">Tips:</p>
                <ul className="list-disc list-inside space-y-1">
                  {Object.entries(passwordStrength.requirements)
                    .filter(([_, met]) => !met)
                    .map(([key]) => (
                      <li key={key}>{PASSWORD_HINTS[key as keyof typeof PASSWORD_HINTS][0]}</li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    // ... rest of JSX ...
  )
} 