'use client'

import { useState, useEffect, useRef } from 'react'
import { useNewAuth } from '@/contexts/new-auth-context'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { User, Mail, Building, Calendar, Shield, Camera, Lock, Check, X, AlertCircle } from 'lucide-react'
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
  const { user, isLoading, updateUser } = useNewAuth()
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
  const [paymentDetails, setPaymentDetails] = useState({
    mobileNumber: '',
    bankAccount: {
      accountNumber: '',
      bankCode: '',
      accountName: ''
    }
  })
  const [emergencyDetails, setEmergencyDetails] = useState({
    name: '',
    relationship: '',
    phone: ''
  })
  const [isSavingPayment, setIsSavingPayment] = useState(false)
  const [isSavingEmergency, setIsSavingEmergency] = useState(false)

  useEffect(() => {
    if (user) {
      setName(user.name)
      setProfileImage(user.avatar || null)
      setPaymentDetails({
        mobileNumber: user.mobileNumber || '',
        bankAccount: {
          accountNumber: user.bankAccount?.accountNumber || '',
          bankCode: user.bankAccount?.bankCode || '',
          accountName: user.bankAccount?.accountName || ''
        }
      })
      setEmergencyDetails({
        name: user.emergencyContact?.name || '',
        relationship: user.emergencyContact?.relationship || '',
        phone: user.emergencyContact?.phone || ''
      })
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

      const formData = new FormData()
      formData.append('file', file)
      const uploadRes = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
      if (!uploadRes.ok) {
        const errBody = await uploadRes.json().catch(() => ({}))
        throw new Error(errBody.error || 'Failed to upload image')
      }
      const { avatarUrl } = await uploadRes.json()
      setProfileImage(avatarUrl)
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

      await updateUser({
        name: name.trim(),
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

      const passwordResponse = await fetch('/api/auth/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })
      if (!passwordResponse.ok) {
        const body = await passwordResponse.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to change password')
      }

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

  const handleSavePaymentDetails = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setIsSavingPayment(true)
    try {
      const mobileNumber = paymentDetails.mobileNumber.trim()
      const bankAccountInput = {
        accountNumber: paymentDetails.bankAccount.accountNumber.trim(),
        bankCode: paymentDetails.bankAccount.bankCode.trim(),
        accountName: paymentDetails.bankAccount.accountName.trim()
      }
      const hasBankAccount = Object.values(bankAccountInput).some(value => value !== '')
      await updateUser({
        mobileNumber: mobileNumber || null,
        bankAccount: hasBankAccount ? bankAccountInput : null
      })
      toast({
        title: 'Payment details saved',
        description: 'Your payroll information has been updated.'
      })
    } catch (err) {
      console.error('Error updating payment details:', err)
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update payment details',
        variant: 'destructive'
      })
    } finally {
      setIsSavingPayment(false)
    }
  }

  const handleSaveEmergencyContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setIsSavingEmergency(true)
    try {
      const trimmed = {
        name: emergencyDetails.name.trim(),
        relationship: emergencyDetails.relationship.trim(),
        phone: emergencyDetails.phone.trim()
      }
      const hasEmergency = Object.values(trimmed).some(value => value !== '')
      await updateUser({
        emergencyContact: hasEmergency ? trimmed : null
      })
      toast({
        title: 'Emergency contact saved',
        description: 'Your emergency contact information has been updated.'
      })
    } catch (err) {
      console.error('Error updating emergency contact:', err)
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update emergency contact',
        variant: 'destructive'
      })
    } finally {
      setIsSavingEmergency(false)
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="w-5 h-5" />
                Payment & Payroll Details
              </CardTitle>
              <CardDescription>
                Provide payment information so payroll can process your payouts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSavePaymentDetails} className="space-y-4">
                <div>
                  <Label htmlFor="paymentMobile">Payment Phone / Mobile Money</Label>
                  <Input
                    id="paymentMobile"
                    value={paymentDetails.mobileNumber}
                    onChange={(e) =>
                      setPaymentDetails(prev => ({ ...prev, mobileNumber: e.target.value }))
                    }
                    placeholder="+233XXXXXXXXX"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="bankAccountNumber">Account Number</Label>
                    <Input
                      id="bankAccountNumber"
                      value={paymentDetails.bankAccount.accountNumber}
                      onChange={(e) =>
                        setPaymentDetails(prev => ({
                          ...prev,
                          bankAccount: { ...prev.bankAccount, accountNumber: e.target.value }
                        }))
                      }
                      placeholder="1234567890"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bankCode">Bank Code</Label>
                    <Input
                      id="bankCode"
                      value={paymentDetails.bankAccount.bankCode}
                      onChange={(e) =>
                        setPaymentDetails(prev => ({
                          ...prev,
                          bankAccount: { ...prev.bankAccount, bankCode: e.target.value }
                        }))
                      }
                      placeholder="000001"
                    />
                  </div>
                  <div>
                    <Label htmlFor="accountName">Account Name</Label>
                    <Input
                      id="accountName"
                      value={paymentDetails.bankAccount.accountName}
                      onChange={(e) =>
                        setPaymentDetails(prev => ({
                          ...prev,
                          bankAccount: { ...prev.bankAccount, accountName: e.target.value }
                        }))
                      }
                      placeholder="John Doe"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={isSavingPayment}>
                    {isSavingPayment ? 'Saving...' : 'Save Payment Details'}
                  </Button>
                </div>
              </form>
              {!paymentDetails.mobileNumber &&
                !Object.values(paymentDetails.bankAccount).some(value => value.trim() !== '') && (
                  <p className="text-sm text-muted-foreground mt-4">
                    Add payment information so finance knows where to send your payouts. You can update this anytime.
                  </p>
                )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Emergency Contact
              </CardTitle>
              <CardDescription>
                Tell us who to notify in case of an emergency
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveEmergencyContact} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="emergencyName">Contact Name</Label>
                    <Input
                      id="emergencyName"
                      value={emergencyDetails.name}
                      onChange={(e) =>
                        setEmergencyDetails(prev => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="Jane Doe"
                    />
                  </div>
                  <div>
                    <Label htmlFor="emergencyRelationship">Relationship</Label>
                    <Input
                      id="emergencyRelationship"
                      value={emergencyDetails.relationship}
                      onChange={(e) =>
                        setEmergencyDetails(prev => ({ ...prev, relationship: e.target.value }))
                      }
                      placeholder="Spouse, Parent, Friend"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="emergencyPhone">Contact Phone</Label>
                  <Input
                    id="emergencyPhone"
                    value={emergencyDetails.phone}
                    onChange={(e) =>
                      setEmergencyDetails(prev => ({ ...prev, phone: e.target.value }))
                    }
                    placeholder="+233XXXXXXXXX"
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={isSavingEmergency}>
                    {isSavingEmergency ? 'Saving...' : 'Save Emergency Contact'}
                  </Button>
                </div>
              </form>
              {!emergencyDetails.name &&
                !emergencyDetails.relationship &&
                !emergencyDetails.phone && (
                  <p className="text-sm text-muted-foreground mt-4">
                    Share an emergency contact so your team can reach someone quickly if needed.
                  </p>
                )}
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