"use client"

import { useNewAuth } from '@/contexts/new-auth-context'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { usePathname } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { NotificationsDropdown } from '@/components/notifications-dropdown'

export function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useNewAuth()
  const pathname = usePathname()
  const isAuthPage = pathname.startsWith('/auth')

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (isAuthPage) {
    return children
  }

  // If no user, don't render the layout
  if (!user) {
    return null
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activePath={pathname} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
} 