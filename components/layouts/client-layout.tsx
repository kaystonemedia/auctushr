'use client'

import { useAuth } from '@/hooks/use-auth'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { usePathname } from 'next/navigation'

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const pathname = usePathname()

  // Don't show layout for auth pages
  if (pathname === '/login' || pathname === '/register') {
    return <>{children}</>
  }

  if (loading) {
    return <div>Loading...</div>
  }

  if (!user) {
    return null
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Fixed sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <div className="flex-1 flex flex-col min-h-0 bg-white border-r">
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            <Sidebar />
          </div>
        </div>
      </div>

      {/* Main content with offset for fixed sidebar */}
      <div className="md:pl-64 flex flex-col flex-1">
        {/* Fixed header */}
        <div className="sticky top-0 z-10 bg-white border-b">
          <Header />
        </div>

        {/* Scrollable main content */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
} 