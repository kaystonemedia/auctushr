"use client"

import { createContext, useContext, useEffect, useState } from 'react'
import { auth, db } from '@/lib/firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import type { User } from '@/types/user'
import { useRouter } from 'next/navigation'
import { ROLE_PERMISSIONS } from '@/types/user'
import Cookies from 'js-cookie'

interface AuthContextType {
  user: User | null
  firebaseUser: any | null
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
  const [user, setUser] = useState<User | null>(null)
  const [firebaseUser, setFirebaseUser] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const router = useRouter()

  const logout = async () => {
    try {
      await signOut(auth)
      Cookies.remove('user-role')
      router.push('/auth/sign-in')
    } catch (error) {
      console.error('Error signing out:', error)
      throw error
    }
  }

  const hasPermission = (permission: keyof typeof ROLE_PERMISSIONS.admin): boolean => {
    if (!user) return false
    return ROLE_PERMISSIONS[user.role][permission]
  }

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          setFirebaseUser(firebaseUser)
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
          if (userDoc.exists()) {
            const userData = userDoc.data()
            const userRole = userData.role || 'employee'
            
            Cookies.set('user-role', userRole, { 
              expires: 7, // 7 days
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production'
            })

            setUser({
              id: userDoc.id,
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: userData.name || '',
              role: userRole,
              department: userData.department,
              managerId: userData.managerId,
              createdAt: userData.createdAt?.toDate(),
              updatedAt: userData.updatedAt?.toDate()
            })
          }
        } else {
          setUser(null)
          setFirebaseUser(null)
          Cookies.remove('user-role')
        }
      } catch (err) {
        console.error('Error in auth state change:', err)
        setError(err instanceof Error ? err : new Error('An error occurred'))
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{
      user,
      firebaseUser,
      loading,
      error,
      isOnline,
      logout,
      hasPermission
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

