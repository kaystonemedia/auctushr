'use client'

import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { ROLE_PERMISSIONS } from '@/types/user'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredPermission?: keyof typeof ROLE_PERMISSIONS.admin
  redirectTo?: string
}

export function ProtectedRoute({
  children,
  requiredPermission,
  redirectTo = '/login',
}: ProtectedRouteProps) {
  const { user, loading, hasPermission } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push(redirectTo)
    }
  }, [loading, user, router, redirectTo])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
} 