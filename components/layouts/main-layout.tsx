"use client"

import { useNewAuth } from '@/contexts/new-auth-context'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { HeaderLogo } from '@/components/ui/logo'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Loader2, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useNewAuth()
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  
  const isAuthPage = pathname.startsWith('/auth')
  const isTestPage = pathname === '/test-auth'

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  // For auth pages, return children without any layout (no header, no sidebar)
  if (isAuthPage) {
    return <>{children}</>
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // If no user, don't render the layout
  if (!user) {
    return null
  }

  // For test pages, render without sidebar/header
  if (isTestPage) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="p-6">
          {children}
        </main>
      </div>
    )
  }

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50" style={{ marginTop: '0' }}>
      {/* Desktop Sidebar - Only shows on md screens and larger */}
      <div className={cn(
        "hidden md:flex md:flex-shrink-0 transition-all duration-300",
        isSidebarCollapsed ? "md:w-16" : "md:w-64"
      )}>
        <Sidebar 
          activePath={pathname} 
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
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
          <div className="relative flex-1 flex flex-col max-w-xs w-full">
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
            <Sidebar 
              activePath={pathname} 
              isCollapsed={false}
              onToggleCollapse={() => setIsMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        {/* Top navigation bar */}
        <div className="relative z-10 flex-shrink-0 flex h-16 bg-white shadow border-b border-gray-200">
          {/* Mobile menu button - Only shows on small screens */}
          <button
            className="flex items-center justify-center px-4 border-r border-gray-200 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 md:hidden"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <Menu className="h-6 w-6" />
          </button>
          
          {/* Header content */}
          <div className="flex-1 px-4 flex justify-between items-center">
            {/* Desktop title - Only shows on larger screens */}
            <div className="hidden md:flex md:items-center">
              <HeaderLogo />
              {user?.role && (
                <span className="ml-3 px-3 py-1 text-sm font-medium text-gray-600 bg-gray-100 rounded-md">
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </span>
              )}
            </div>
            
            {/* Mobile title - Only shows on small screens */}
            <div className="md:hidden">
              <HeaderLogo size="md" />
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