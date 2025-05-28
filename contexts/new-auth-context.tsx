'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { auth, db } from '@/lib/firebase'
import { onAuthStateChanged, signOut as firebaseSignOut, User as FirebaseUser } from 'firebase/auth'
import { doc, getDoc, collection, query, where, limit, getDocs } from 'firebase/firestore'
import { toast } from 'react-hot-toast'
import { useRouter, usePathname } from 'next/navigation'
import { signIn } from '@/lib/firebase'

interface User {
  id: string
  email: string
  name: string
  role: string
  department?: string
  position?: string
  avatar?: string
  createdAt: Date
  updatedAt: Date
}

interface AuthContextType {
  user: User | null
  firebaseUser: FirebaseUser | null
  isLoading: boolean
  error: string | null
  login: (email: string, password: string, isPasswordSetup?: boolean) => Promise<void>
  logout: () => Promise<void>
  updateUser: (data: Partial<User>) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Define role-based route access
const roleBasedRoutes = {
  admin: [
    '/dashboard',
    '/profile',
    '/employees',
    '/attendance',
    '/attendance/reports',
    '/leave',
    '/payroll',
    '/documents',
    '/productivity',
    '/performance',
    '/settings',
    '/help'
  ],
  manager: [
    '/dashboard',
    '/profile',
    '/employees',
    '/attendance',
    '/attendance/reports',
    '/leave',
    '/payroll',
    '/documents',
    '/productivity',
    '/performance',
    '/settings',
    '/help'
  ],
  employee: [
    '/dashboard',
    '/profile',
    '/attendance',
    '/leave',
    '/documents',
    '/productivity',
    '/performance',
    '/settings',
    '/help'
  ]
}

export function NewAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Handle navigation based on auth state and role
  useEffect(() => {
    if (isLoading) return

    const handleNavigation = async () => {
      // If on auth pages and user is authenticated, redirect to dashboard
      if (pathname?.startsWith('/auth/') && user) {
        console.log('Authenticated user on auth page, redirecting to dashboard')
        router.push('/dashboard')
        return
      }

      // If not on auth pages and user is not authenticated, redirect to sign-in
      if (!pathname?.startsWith('/auth/') && !user) {
        console.log('Unauthenticated user on protected page, redirecting to sign-in')
        router.push('/auth/sign-in')
        return
      }

      // Check role-based access
      if (user && !pathname?.startsWith('/auth/')) {
        const allowedRoutes = roleBasedRoutes[user.role as keyof typeof roleBasedRoutes]
        if (allowedRoutes && !allowedRoutes.some(route => pathname?.startsWith(route))) {
          console.log('User role does not have access to this route')
          router.push('/unauthorized')
          return
        }
      }
    }

    handleNavigation()
  }, [user, isLoading, pathname, router])

  // Initialize auth state
  useEffect(() => {
    console.log('Initializing auth state')
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('Firebase auth state changed:', { 
        hasUser: !!firebaseUser,
        uid: firebaseUser?.uid
      })

      setFirebaseUser(firebaseUser)
      
      if (firebaseUser) {
        try {
          // Get the ID token
          const idToken = await firebaseUser.getIdToken()
          
          // Create session cookie
          const response = await fetch('/api/auth/session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ idToken }),
          })

          if (!response.ok) {
            throw new Error('Failed to create session')
          }

          console.log('Session cookie created successfully')

          // Get user data from Firestore
          console.log('Fetching user data for:', firebaseUser.uid)
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
          
          if (userDoc.exists()) {
            const userData = userDoc.data()
            console.log('User data found:', { 
              id: userDoc.id,
              role: userData.role,
              email: userData.email 
            })

            const newUser = {
              id: userDoc.id,
              email: userData.email,
              name: userData.name,
              role: userData.role,
              department: userData.department,
              position: userData.position,
              avatar: userData.avatar,
              createdAt: userData.createdAt?.toDate(),
              updatedAt: userData.updatedAt?.toDate()
            }
            setUser(newUser)
          } else {
            console.log('No user document found for:', firebaseUser.uid)
            setUser(null)
          }
        } catch (error) {
          console.error('Error setting up session:', error)
          setUser(null)
          await firebaseSignOut(auth)
        }
      } else {
        console.log('No Firebase user, clearing user state')
        setUser(null)
      }
      
      setIsLoading(false)
    })

    return () => {
      console.log('Cleaning up auth state listener')
      unsubscribe()
    }
  }, [])

  const login = async (email: string, password: string, isPasswordSetup: boolean = false) => {
    console.log('Login attempt for:', email, 'isPasswordSetup:', isPasswordSetup)
    try {
      setIsLoading(true)
      setError(null)
      
      // Use the signIn function from firebase.ts
      console.log('Signing in with Firebase')
      const user = await signIn(email, password, isPasswordSetup)
      console.log('Firebase sign in successful:', user.uid)
      
      // Get user data from Firestore - query by email
      console.log('Fetching user data')
      const employeesRef = collection(db, 'employees')
      const q = query(
        employeesRef,
        where('email', '==', email),
        limit(1)
      )
      const querySnapshot = await getDocs(q)
      
      let userDoc = querySnapshot.docs[0]
      let userData = userDoc?.exists() ? userDoc.data() : null
      
      if (!userDoc?.exists() || !userData) {
        // Try users collection as fallback
        const usersRef = collection(db, 'users')
        const userQuery = query(
          usersRef,
          where('email', '==', email),
          limit(1)
        )
        const userSnapshot = await getDocs(userQuery)
        userDoc = userSnapshot.docs[0]
        userData = userDoc?.exists() ? userDoc.data() : null
      }
      
      if (!userDoc?.exists() || !userData) {
        console.log('No user document found')
        throw new Error('User profile not found')
      }

      console.log('User data retrieved:', { 
        id: userDoc.id,
        role: userData.role,
        email: userData.email 
      })

      if (!userData.role) {
        console.log('No role found for user')
        throw new Error('First time login - please set up your profile')
      }

      // Set user state
      const newUser = {
        id: userDoc.id,
        email: userData.email,
        name: `${userData.firstName} ${userData.lastName}`.trim(),
        role: userData.role,
        department: userData.department,
        position: userData.position,
        avatar: userData.avatar,
        createdAt: userData.createdAt?.toDate(),
        updatedAt: userData.updatedAt?.toDate()
      }
      console.log('Setting user state')
      setUser(newUser)
      
      toast.success('Successfully signed in')
      console.log('Login process completed successfully')

      // Navigation will be handled by the useEffect
    } catch (error: unknown) {
      console.error('Login error:', error)
      let errorMessage = 'Failed to sign in'
      
      if (error instanceof Error) {
        if (error.message === 'First time login - please set up your profile') {
          errorMessage = error.message
        } else if (error.message === 'FIRST_TIME_LOGIN') {
          throw error // Let the sign-in form handle this
        } else if (error.message.includes('auth/user-not-found') || error.message.includes('auth/wrong-password')) {
          errorMessage = 'Invalid email or password'
        } else if (error.message.includes('auth/too-many-requests')) {
          errorMessage = 'Too many failed attempts. Please try again later'
        } else if (error.message.includes('auth/network-request-failed')) {
          errorMessage = 'Network error. Please check your connection and try again.'
        } else if (error.message.includes('auth/missing-password')) {
          errorMessage = 'Password is required'
        }
      }
      
      setError(errorMessage)
      toast.error(errorMessage)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    console.log('Logout attempt')
    try {
      setIsLoading(true)
      
      // Call the logout API to clear the session cookie
      await fetch('/api/auth/logout', { method: 'POST' })
      
      // Sign out from Firebase
      await firebaseSignOut(auth)
      console.log('Firebase sign out successful')
      
      setUser(null)
      setFirebaseUser(null)
      toast.success('Successfully signed out')
      console.log('Logout process completed')
      
      // Navigation will be handled by the useEffect
    } catch (error) {
      console.error('Logout error:', error)
      setError('Failed to sign out')
      toast.error('Failed to sign out')
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const updateUser = async (data: Partial<User>) => {
    console.log('Update user attempt:', data)
    // This is a placeholder for user update functionality
    // Implement actual user update logic here
  }

  return (
    <AuthContext.Provider value={{
      user,
      firebaseUser,
      isLoading,
      error,
      login,
      logout,
      updateUser
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useNewAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useNewAuth must be used within a NewAuthProvider')
  }
  return context
} 