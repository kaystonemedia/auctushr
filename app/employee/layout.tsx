'use client'

import { useAuth } from '@/contexts/auth-context'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { usePathname } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const pathname = usePathname()

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user || user.role !== 'employee') {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} />
      <div className="flex">
        <Sidebar activePath={pathname} />
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  )
} 