"use client"

import { createContext, useContext } from 'react'
import type { User } from '@/types/user'
import { ROLE_PERMISSIONS } from '@/types/user'
import { useNewAuth } from '@/contexts/new-auth-context'

interface AuthContextType {
  user: User | null
  firebaseUser: null
  loading: boolean
  error: Error | null
  isOnline: boolean
  logout: () => Promise<void>
  hasPermission: (permission: keyof typeof ROLE_PERMISSIONS.admin) => boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  firebaseUser: null,
  loading: true,
  error: null,
  isOnline: true,
  logout: async () => {},
  hasPermission: () => false
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading, error, logout } = useNewAuth()

  const normalizedUser: User | null = user
    ? {
        id: user.id,
        uid: user.uid,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
        managerId: user.managerId ?? undefined,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    : null

  const hasPermission = (permission: keyof typeof ROLE_PERMISSIONS.admin): boolean => {
    if (!normalizedUser) return false
    return ROLE_PERMISSIONS[normalizedUser.role][permission]
  }

  return (
    <AuthContext.Provider
      value={{
        user: normalizedUser,
        firebaseUser: null,
        loading: isLoading,
        error: error ? new Error(error) : null,
        isOnline: true,
        logout,
        hasPermission
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
