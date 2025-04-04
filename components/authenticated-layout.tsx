'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { Loader2 } from 'lucide-react'

// List of paths that don't require authentication
const publicPaths = ['/auth/sign-in', '/auth/sign-up', '/auth/forgot-password']

// List of paths that can be accessed without authentication
const optionalPaths = ['/auth/reset-password']

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading) {
      const isPublicPath = publicPaths.includes(pathname)
      const isOptionalPath = optionalPaths.includes(pathname)
      
      console.log('AuthenticatedLayout: Checking auth state:', {
        isPublicPath,
        isOptionalPath,
        hasUser: !!user,
        pathname
      })

      if (!user && !isPublicPath && !isOptionalPath) {
        console.log('AuthenticatedLayout: Redirecting to sign-in')
        router.replace('/auth/sign-in')
      }
    }
  }, [user, loading, pathname, router])

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // For public paths, render without layout
  if (publicPaths.includes(pathname)) {
    return <>{children}</>
  }

  // For optional paths, render without layout
  if (optionalPaths.includes(pathname)) {
    return <>{children}</>
  }

  // For authenticated routes, render with full layout
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-gray-100 p-4">
          {children}
        </main>
      </div>
    </div>
  )
} 