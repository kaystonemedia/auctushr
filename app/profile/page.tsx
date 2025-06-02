'use client'

import { useState, useEffect, useRef } from 'react'
import { useNewAuth } from '@/contexts/new-auth-context'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { User, Mail, Building, Calendar, Shield, Camera, Lock, Check, X } from 'lucide-react'
import { doc, updateDoc } from 'firebase/firestore'
import { updatePassword } from 'firebase/auth'
import { db, auth } from '@/lib/firebase'
import { uploadFile } from '@/lib/storage'
import { checkPasswordStrength, validatePassword, PASSWORD_REQUIREMENTS, PASSWORD_HINTS, type PasswordStrength } from '@/lib/password-validation'

// Password strength requirements
const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  hasUpperCase: /[A-Z]/,
  hasLowerCase: /[a-z]/,
  hasNumber: /[0-9]/,
  hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/
}

// Password strength hints
const PASSWORD_HINTS = {
  minLength: [
    'Use at least 8 characters',
    'Longer passwords are more secure',
    'Consider using a phrase or sentence'
  ],
  hasUpperCase: [
    'Add at least one uppercase letter',
    'Try capitalizing the first letter of each word',
    'Use acronyms for memorable phrases'
  ],
  hasLowerCase: [
    'Include lowercase letters',
    'Mix case for better security',
    'Use a combination of upper and lower case'
  ],
  hasNumber: [
    'Add numbers to your password',
    'Try replacing letters with numbers (e.g., "a" with "4")',
    'Include your birth year or other memorable numbers'
  ],
  hasSpecialChar: [
    'Use special characters (!@#$%^&*)',
    'Replace letters with similar-looking symbols',
    'Add punctuation marks between words'
  ],
  general: [
    'Avoid common words and phrases',
    'Don\'t use personal information',
    'Use a unique password for each account',
    'Consider using a password manager'
  ]
}

// Password strength suggestions based on score
const PASSWORD_SUGGESTIONS = {
  0: 'Your password is very weak. Try adding more complexity.',
  1: 'Your password is weak. Add more variety to make it stronger.',
  2: 'Your password is medium strength. Add a few more requirements.',
  3: 'Your password is strong. Just a few more requirements to make it very strong.',
  4: 'Your password is very strong! Just add one more requirement.',
  5: 'Excellent! Your password meets all requirements.'
}

interface PasswordStrength {
  score: number
  requirements: {
    minLength: boolean
    hasUpperCase: boolean
    hasLowerCase: boolean
    hasNumber: boolean
    hasSpecialChar: boolean
  }
}

export default function ProfilePage() {
  const { user, isLoading } = useNewAuth()
  const isOnline = useOnlineStatus()
  const [isEditing, setIsEditing] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [name, setName] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>({
    score: 0,
    requirements: {
      minLength: false,
      hasUpperCase: false,
      hasLowerCase: false,
      hasNumber: false,
      hasSpecialChar: false
    }
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user) {
      setName(user.name)
      setProfileImage(user.avatar || null)
    }
  }, [user])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    setLoading(true)
    setError(null)

    try {
      if (!isOnline) {
        throw new Error('You are currently offline. Please check your internet connection.')
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Please upload an image file')
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Image size should be less than 5MB')
      }

      // Upload image using our custom storage utility
      const downloadURL = await uploadFile(file, `profile-images/${user.id}`)

      // Update user document with new image URL
      await updateDoc(doc(db, 'users', user.id), {
        avatar: downloadURL,
        updatedAt: new Date()
      })

      setProfileImage(downloadURL)
      setSuccess(true)
    } catch (err) {
      console.error('Error uploading image:', err)
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to upload image')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      if (!isOnline) {
        throw new Error('You are currently offline. Please check your internet connection.')
      }

      await updateDoc(doc(db, 'users', user.id), {
        name,
        updatedAt: new Date()
      })

      setSuccess(true)
      setIsEditing(false)
    } catch (err) {
      console.error('Error updating profile:', err)
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to update profile')
      }
    } finally {
      setLoading(false)
    }
  }

  const checkPasswordStrength = (password: string) => {
    const requirements = {
      minLength: password.length >= PASSWORD_REQUIREMENTS.minLength,
      hasUpperCase: PASSWORD_REQUIREMENTS.hasUpperCase.test(password),
      hasLowerCase: PASSWORD_REQUIREMENTS.hasLowerCase.test(password),
      hasNumber: PASSWORD_REQUIREMENTS.hasNumber.test(password),
      hasSpecialChar: PASSWORD_REQUIREMENTS.hasSpecialChar.test(password)
    }

    const score = Object.values(requirements).filter(Boolean).length

    setPasswordStrength({
      score,
      requirements
    })
  }

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

      // Check if all password requirements are met
      const allRequirementsMet = Object.values(passwordStrength.requirements).every(Boolean)
      if (!allRequirementsMet) {
        throw new Error('Password does not meet all requirements')
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Loading...</h2>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Please sign in to view your profile</h2>
        </div>
      </div>
    )
  }

  return (
    <main className="flex-1 overflow-y-auto p-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Profile Image Section */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center space-x-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100">
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-12 h-12 text-gray-400" />
                  </div>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || !isOnline}
                className="absolute bottom-0 right-0 bg-black text-white rounded-full p-2 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">Profile Picture</h3>
              <p className="text-sm text-gray-500">Upload a new profile picture</p>
            </div>
          </div>
        </div>

        {/* Profile Information Section */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Profile Information</h3>
              <div className="space-x-3">
                <button
                  onClick={() => setIsChangingPassword(!isChangingPassword)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  {isChangingPassword ? 'Cancel Password Change' : 'Change Password'}
                </button>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {isEditing ? 'Cancel' : 'Edit Profile'}
                </button>
              </div>
            </div>
          </div>

          <div className="px-4 py-5 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name Field */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    name="name"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!isEditing}
                    className={`block w-full pl-10 pr-3 py-2 border rounded-md sm:text-sm ${
                      isEditing
                        ? 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                        : 'border-transparent bg-gray-50'
                    }`}
                  />
                </div>
              </div>

              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    name="email"
                    id="email"
                    value={user.email}
                    disabled
                    className="block w-full pl-10 pr-3 py-2 border border-transparent bg-gray-50 rounded-md sm:text-sm"
                  />
                </div>
              </div>

              {/* Role Field */}
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                  Role
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Shield className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    name="role"
                    id="role"
                    value={user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    disabled
                    className="block w-full pl-10 pr-3 py-2 border border-transparent bg-gray-50 rounded-md sm:text-sm"
                  />
                </div>
              </div>

              {/* Department Field */}
              <div>
                <label htmlFor="department" className="block text-sm font-medium text-gray-700">
                  Department
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Building className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    name="department"
                    id="department"
                    value={user.department || 'Not assigned'}
                    disabled
                    className="block w-full pl-10 pr-3 py-2 border border-transparent bg-gray-50 rounded-md sm:text-sm"
                  />
                </div>
              </div>

              {/* Member Since Field */}
              <div>
                <label htmlFor="memberSince" className="block text-sm font-medium text-gray-700">
                  Member Since
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    name="memberSince"
                    id="memberSince"
                    value={user.createdAt ? user.createdAt.toLocaleDateString() : 'N/A'}
                    disabled
                    className="block w-full pl-10 pr-3 py-2 border border-transparent bg-gray-50 rounded-md sm:text-sm"
                  />
                </div>
              </div>

              {/* Password Change Form */}
              {isChangingPassword && (
                <div className="pt-6 border-t border-gray-200">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Change Password</h4>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700">
                        Current Password
                      </label>
                      <input
                        type="password"
                        id="currentPassword"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                        New Password
                      </label>
                      <input
                        type="password"
                        id="newPassword"
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value)
                          checkPasswordStrength(e.target.value)
                        }}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        required
                      />
                      {/* Password Strength Indicator */}
                      <div className="mt-2">
                        <div className="flex items-center space-x-2">
                          <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                passwordStrength.score === 0
                                  ? 'w-0 bg-gray-200'
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
                          <span className="text-xs text-gray-500">
                            {passwordStrength.score === 0
                              ? 'Very Weak'
                              : passwordStrength.score === 1
                              ? 'Weak'
                              : passwordStrength.score === 2
                              ? 'Medium'
                              : passwordStrength.score === 3
                              ? 'Strong'
                              : 'Very Strong'}
                          </span>
                        </div>

                        {/* Password Strength Suggestion */}
                        <div className="mt-2">
                          <p className={`text-sm ${
                            passwordStrength.score <= 1 ? 'text-red-500' :
                            passwordStrength.score <= 2 ? 'text-yellow-500' :
                            passwordStrength.score <= 3 ? 'text-blue-500' :
                            'text-green-500'
                          }`}>
                            {PASSWORD_SUGGESTIONS[passwordStrength.score as keyof typeof PASSWORD_SUGGESTIONS]}
                          </p>
                        </div>

                        {/* Password Requirements */}
                        <div className="mt-2 space-y-1">
                          <p className="text-xs text-gray-500">Password requirements:</p>
                          <ul className="text-xs space-y-1">
                            <li className={`flex items-center ${passwordStrength.requirements.minLength ? 'text-green-500' : 'text-gray-500'}`}>
                              {passwordStrength.requirements.minLength ? <Check className="w-3 h-3 mr-1" /> : <X className="w-3 h-3 mr-1" />}
                              At least {PASSWORD_REQUIREMENTS.minLength} characters
                            </li>
                            <li className={`flex items-center ${passwordStrength.requirements.hasUpperCase ? 'text-green-500' : 'text-gray-500'}`}>
                              {passwordStrength.requirements.hasUpperCase ? <Check className="w-3 h-3 mr-1" /> : <X className="w-3 h-3 mr-1" />}
                              One uppercase letter
                            </li>
                            <li className={`flex items-center ${passwordStrength.requirements.hasLowerCase ? 'text-green-500' : 'text-gray-500'}`}>
                              {passwordStrength.requirements.hasLowerCase ? <Check className="w-3 h-3 mr-1" /> : <X className="w-3 h-3 mr-1" />}
                              One lowercase letter
                            </li>
                            <li className={`flex items-center ${passwordStrength.requirements.hasNumber ? 'text-green-500' : 'text-gray-500'}`}>
                              {passwordStrength.requirements.hasNumber ? <Check className="w-3 h-3 mr-1" /> : <X className="w-3 h-3 mr-1" />}
                              One number
                            </li>
                            <li className={`flex items-center ${passwordStrength.requirements.hasSpecialChar ? 'text-green-500' : 'text-gray-500'}`}>
                              {passwordStrength.requirements.hasSpecialChar ? <Check className="w-3 h-3 mr-1" /> : <X className="w-3 h-3 mr-1" />}
                              One special character
                            </li>
                          </ul>
                        </div>

                        {/* Password Hints */}
                        <div className="mt-3">
                          <p className="text-xs text-gray-500 mb-1">Tips to improve your password:</p>
                          <ul className="text-xs space-y-1">
                            {!passwordStrength.requirements.minLength && (
                              <li className="text-gray-600">• {PASSWORD_HINTS.minLength[Math.floor(Math.random() * PASSWORD_HINTS.minLength.length)]}</li>
                            )}
                            {!passwordStrength.requirements.hasUpperCase && (
                              <li className="text-gray-600">• {PASSWORD_HINTS.hasUpperCase[Math.floor(Math.random() * PASSWORD_HINTS.hasUpperCase.length)]}</li>
                            )}
                            {!passwordStrength.requirements.hasLowerCase && (
                              <li className="text-gray-600">• {PASSWORD_HINTS.hasLowerCase[Math.floor(Math.random() * PASSWORD_HINTS.hasLowerCase.length)]}</li>
                            )}
                            {!passwordStrength.requirements.hasNumber && (
                              <li className="text-gray-600">• {PASSWORD_HINTS.hasNumber[Math.floor(Math.random() * PASSWORD_HINTS.hasNumber.length)]}</li>
                            )}
                            {!passwordStrength.requirements.hasSpecialChar && (
                              <li className="text-gray-600">• {PASSWORD_HINTS.hasSpecialChar[Math.floor(Math.random() * PASSWORD_HINTS.hasSpecialChar.length)]}</li>
                            )}
                            {passwordStrength.score < 3 && (
                              <li className="text-gray-600">• {PASSWORD_HINTS.general[Math.floor(Math.random() * PASSWORD_HINTS.general.length)]}</li>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        id="confirmPassword"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        required
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handlePasswordChange}
                        disabled={loading || !isOnline || passwordStrength.score < 4}
                        className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                          loading || !isOnline || passwordStrength.score < 4
                            ? 'bg-blue-400 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                        }`}
                      >
                        {loading ? 'Updating...' : 'Update Password'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="text-red-500 text-sm">{error}</div>
              )}

              {success && (
                <div className="text-green-500 text-sm">Profile updated successfully!</div>
              )}

              {isEditing && (
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={loading || !isOnline}
                    className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                      loading || !isOnline
                        ? 'bg-blue-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                    }`}
                  >
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </main>
  )
} 