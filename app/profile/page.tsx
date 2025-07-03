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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'
import { useNetwork } from '@/hooks/use-network'

// Password strength requirements
// const PASSWORD_REQUIREMENTS = {
//   minLength: 8,
//   hasUpperCase: /[A-Z]/,
//   hasLowerCase: /[a-z]/,
//   hasNumber: /[0-9]/,
//   hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/
// }

// Password strength hints
// const PASSWORD_HINTS = {
//   minLength: [
//     'Use at least 8 characters',
//     'Longer passwords are more secure',
//     'Consider using a phrase or sentence'
//   ],
//   hasUpperCase: [
//     'Add at least one uppercase letter',
//     'Try capitalizing the first letter of each word',
//     'Use acronyms for memorable phrases'
//   ],
//   hasLowerCase: [
//     'Include lowercase letters',
//     'Mix case for better security',
//     'Use a combination of upper and lower case'
//   ],
//   hasNumber: [
//     'Add numbers to your password',
//     'Try replacing letters with numbers (e.g., "a" with "4")',
//     'Include your birth year or other memorable numbers'
//   ],
//   hasSpecialChar: [
//     'Use special characters (!@#$%^&*)',
//     'Replace letters with similar-looking symbols',
//     'Add punctuation marks between words'
//   ],
//   general: [
//     'Avoid common words and phrases',
//     'Don\'t use personal information',
//     'Use a unique password for each account',
//     'Consider using a password manager'
//   ]
// }

// Password strength suggestions based on score
const PASSWORD_SUGGESTIONS = {
  0: 'Your password is very weak. Try adding more complexity.',
  1: 'Your password is weak. Add more variety to make it stronger.',
  2: 'Your password is medium strength. Add a few more requirements.',
  3: 'Your password is strong. Just a few more requirements to make it very strong.',
  4: 'Your password is very strong! Just add one more requirement.',
  5: 'Excellent! Your password meets all requirements.'
}

export default function ProfilePage() {
  const { user, isLoading } = useNewAuth()
  const { toast } = useToast()
  const { isOnline } = useNetwork()
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

  useEffect(() => {
    if (newPassword) {
      const strength = checkPasswordStrength(newPassword)
      setPasswordStrength(strength)
    } else {
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
    }
  }, [newPassword])

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

      toast({
        title: "Password Updated",
        description: "Your password has been successfully changed.",
      })

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
        toast({
          title: "Error",
          description: err.message,
          variant: "destructive",
        })
      } else {
        setError('Failed to change password')
        toast({
          title: "Error",
          description: "Failed to change password",
          variant: "destructive",
        })
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
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
        <p className="text-gray-600 mt-2">Manage your account settings and preferences</p>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        {/* Profile Information */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Personal Information
              </CardTitle>
              <CardDescription>
                Your basic profile information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={user.name || ''}
                    disabled
                    className="mt-1"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={user.email || ''}
                  disabled
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={user.department || 'Not assigned'}
                    disabled
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="position">Position</Label>
                  <Input
                    id="position"
                    value={user.position || 'Not assigned'}
                    disabled
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-gray-500" />
                <Badge variant={user.role === 'admin' ? 'destructive' : user.role === 'manager' ? 'default' : 'secondary'}>
                  {user.role?.charAt(0).toUpperCase() + user.role?.slice(1) || 'Employee'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Password Change Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Security
              </CardTitle>
              <CardDescription>
                Change your password and manage security settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!isChangingPassword ? (
                <Button
                  onClick={() => setIsChangingPassword(true)}
                  variant="outline"
                >
                  Change Password
                </Button>
              ) : (
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div>
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="mt-1"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="mt-1"
                      required
                    />
                  </div>

                  {/* Password Strength Indicator */}
                  {newPassword && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                      <div className="text-sm font-medium text-gray-700 mb-2">Password Strength:</div>
                      <div className="h-2 bg-gray-200 rounded-full mb-2">
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
                      <div className="space-y-1">
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
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button type="submit" disabled={loading}>
                      {loading ? 'Updating...' : 'Update Password'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsChangingPassword(false)
                        setCurrentPassword('')
                        setNewPassword('')
                        setConfirmPassword('')
                        setError(null)
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Profile Picture and Quick Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5" />
                Profile Picture
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <Avatar className="w-24 h-24 mx-auto mb-4">
                <AvatarImage src={user.avatar || ''} alt={user.name || 'User'} />
                <AvatarFallback>
                  {user.name?.charAt(0) || user.email?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <Button variant="outline" size="sm" disabled>
                Upload Photo
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600">{user.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Building className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600">{user.department || 'Not assigned'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600">
                  Joined {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
} 