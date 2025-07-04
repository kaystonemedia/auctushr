'use client'

import { useAuth } from '@/hooks/use-auth'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

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

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      {/* Desktop Sidebar - Only shows on md screens and larger */}
      <div className="hidden md:flex md:flex-shrink-0 md:w-64 bg-white border-r border-gray-200">
        <div className="flex flex-col w-full">
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            <div className="flex items-center flex-shrink-0 px-4 mb-5">
              <h2 className="text-lg font-semibold text-gray-900">Navigation</h2>
            </div>
            <Sidebar />
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Overlay - Only shows when menu is open on small screens */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 flex z-50 md:hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-gray-600 bg-opacity-75"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          
          {/* Sidebar */}
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
            {/* Close button */}
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <X className="h-6 w-6 text-white" />
              </button>
            </div>
            
            {/* Sidebar content */}
            <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
              <div className="flex-shrink-0 flex items-center px-4 mb-5">
                <h2 className="text-lg font-semibold text-gray-900">KayStone HR</h2>
              </div>
              <nav>
                <Sidebar />
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        {/* Top navigation bar */}
        <div className="relative z-10 flex-shrink-0 flex h-16 bg-white shadow border-b border-gray-200">
          {/* Mobile menu button - Only shows on small screens */}
          <button
            className="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 md:hidden"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <Menu className="h-6 w-6" />
          </button>
          
          {/* Header content */}
          <div className="flex-1 px-4 flex justify-between items-center">
            {/* Desktop title - Only shows on larger screens */}
            <div className="hidden md:flex md:items-center">
              <h1 className="text-xl font-semibold text-gray-900">KayStone HR</h1>
              {user?.role && (
                <span className="ml-3 px-2 py-1 text-sm font-medium text-gray-600 bg-gray-100 rounded-full">
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </span>
              )}
            </div>
            
            {/* Mobile title - Only shows on small screens */}
            <div className="md:hidden">
              <h1 className="text-lg font-semibold text-gray-900">KayStone HR</h1>
            </div>
            
            {/* Right side content */}
            <Header />
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
} 