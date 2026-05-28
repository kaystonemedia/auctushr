"use client"

import { useNewAuth } from '@/contexts/new-auth-context'
import { Loader2 } from 'lucide-react'
import { AuthLogo } from '@/components/ui/logo'

interface AuthLayoutProps {
  children: React.ReactNode
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  const { isLoading } = useNewAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex justify-center py-8">
        <AuthLogo />
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
} 