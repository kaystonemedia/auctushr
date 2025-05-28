'use client'

import { SignInForm } from '@/components/sign-in-form'
import { useNewAuth } from '@/contexts/new-auth-context'
import { Loader2 } from 'lucide-react'

export default function SignInPage() {
  const { isLoading } = useNewAuth()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <SignInForm />
      </div>
    </div>
  )
}

