"use client"

import { useState } from "react"
import { useNewAuth } from "@/contexts/new-auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"
import { validateSignUpPassword } from "@/lib/password-validation"

interface FirstTimePasswordChangeProps {
  email: string
  onSuccess: () => void
  onCancel: () => void
}

export function FirstTimePasswordChange({
  email,
  onSuccess,
  onCancel
}: FirstTimePasswordChangeProps) {
  const { login } = useNewAuth()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      // Validate passwords
      if (password !== confirmPassword) {
        throw new Error("Passwords do not match")
      }

      const passwordError = validateSignUpPassword(password)
      if (passwordError) {
        throw new Error(passwordError)
      }

      // Use login with isPasswordSetup=true to create the account and set the password
      await login(email, password, true)
      onSuccess()
    } catch (error) {
      console.error('Password setup error:', error)
      if (error instanceof Error) {
        if (error.message.includes('auth/email-already-in-use')) {
          setError('This email is already registered. Please try signing in instead.')
        } else if (error.message.includes('auth/weak-password')) {
          setError('Password is too weak. Please ensure it meets all requirements.')
        } else if (error.message.includes('auth/missing-password')) {
          setError('Password is required')
        } else {
          setError(error.message)
        }
      } else {
        setError('An error occurred while setting up your password')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div>
        <Input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
        />
      </div>

      <div>
        <Input
          type="password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          disabled={loading}
        />
      </div>

      <div className="flex space-x-4">
        <Button
          type="submit"
          className="flex-1"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Set Password"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
} 