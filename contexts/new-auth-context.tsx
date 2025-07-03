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
  requiresPasswordChange: boolean
}

interface AuthError extends Error {
  code?: string;
  message: string;
}

interface AuthContextType {
  user: User | null
  firebaseUser: FirebaseUser | null
  isLoading: boolean
  error: string | null
  login: (email: string, password: string, isPasswordSetup?: boolean) => Promise<void>
  logout: () => Promise<void>
  updateUser: (data: Partial<User>) => Promise<void>
  requiresPasswordChange: boolean
}

export const NewAuthContext = createContext<AuthContextType>({
  user: null,
  firebaseUser: null,
  isLoading: true,
  error: null,
  login: async () => {},
  logout: async () => {},
  updateUser: async () => {},
  requiresPasswordChange: false
})

// Define role-based route access
const roleBasedRoutes = {
  admin: [
    '/dashboard',
    '/profile',
    '/employees',
    '/attendance',
    '/attendance/reports',
    '/attendance/settings',
    '/leave',
    '/payroll',
    '/documents',
    '/productivity',
    '/performance',
    '/settings',
    '/help',
    '/managers',
    '/administrators',
    '/tasks',
    '/departments',
    '/people',
    '/wellness-check-in',
    '/whos-away',
    '/test-auth',
    '/add-employee',
    '/todo'
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
    '/help',
    '/tasks',
    '/departments',
    '/people',
    '/wellness-check-in',
    '/whos-away',
    '/test-auth'
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
    '/help',
    '/tasks',
    '/wellness-check-in',
    '/test-auth'
  ]
}

export function NewAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false)

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
        // Allow test pages for all authenticated users
        if (pathname === '/test-auth') {
          return
        }
        
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
          let userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
          let userData: Record<string, unknown> | null = userDoc.exists() ? (userDoc.data() as Record<string, unknown>) : null;

          if (!userData) {
            // Try managers collection by uid
            const managerQuery = query(
              collection(db, 'managers'),
              where('uid', '==', firebaseUser.uid),
              limit(1)
            );
            const managerSnap = await getDocs(managerQuery);
            if (!managerSnap.empty) {
              userDoc = managerSnap.docs[0];
              userData = userDoc.data() as Record<string, unknown>;
              if (userData) {
                userData.name = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
                userData.role = 'manager';
              }
            }
          }

          if (!userData) {
            // Try employees collection by uid
            const employeeQuery = query(
              collection(db, 'employees'),
              where('uid', '==', firebaseUser.uid),
              limit(1)
            );
            const employeeSnap = await getDocs(employeeQuery);
            if (!employeeSnap.empty) {
              userDoc = employeeSnap.docs[0];
              userData = userDoc.data() as Record<string, unknown>;
              if (userData) {
                userData.name = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
                userData.role = 'employee';
              }
            }
          }

          if (!userData) {
            console.log("No user document (employee, user, or manager) found for:", firebaseUser.uid);
            setUser({ id: firebaseUser.uid, email: (auth.currentUser?.email || ""), name: "Unknown", role: "unknown", createdAt: new Date(), updatedAt: new Date(), requiresPasswordChange: false });
            console.warn("User authenticated (Firebase Auth) but no Firestore document found. (Access denied or restricted page.)");
            return;
          }
          setUser({
            id: userDoc.id,
            email: typeof userData.email === 'string' ? userData.email : '',
            name: typeof userData.name === 'string' ? userData.name : '',
            role: typeof userData.role === 'string' ? userData.role : 'unknown',
            createdAt: (userData.createdAt && typeof userData.createdAt === 'object' && 'toDate' in userData.createdAt) ? (userData.createdAt as { toDate: () => Date }).toDate() : new Date(),
            updatedAt: (userData.updatedAt && typeof userData.updatedAt === 'object' && 'toDate' in userData.updatedAt) ? (userData.updatedAt as { toDate: () => Date }).toDate() : new Date(),
            requiresPasswordChange: typeof userData.requiresPasswordChange === 'boolean' ? userData.requiresPasswordChange : false
          });
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
        email: userData.email,
        requiresPasswordChange: userData.requiresPasswordChange
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
        updatedAt: userData.updatedAt?.toDate(),
        requiresPasswordChange: userData.requiresPasswordChange || false
      }

      setUser(newUser)
      setFirebaseUser(user)
      setRequiresPasswordChange(userData.requiresPasswordChange || false)

      // Redirect based on password change requirement only
      if (userData.requiresPasswordChange && !isPasswordSetup) {
        router.push('/auth/change-password')
      } else {
        // Always redirect to dashboard, let the dashboard handle role-based access
        router.push('/dashboard')
      }
    } catch (error: unknown) {
      console.error('Login error:', error)
      const authError = error as AuthError
      if (authError.message === 'PASSWORD_CHANGE_REQUIRED') {
        setRequiresPasswordChange(true)
        router.push('/auth/change-password')
      } else {
        setError(authError.message || 'Failed to sign in')
      }
      throw authError
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
    <NewAuthContext.Provider value={{
      user,
      firebaseUser,
      isLoading,
      error,
      login,
      logout,
      updateUser,
      requiresPasswordChange
    }}>
      {children}
    </NewAuthContext.Provider>
  )
}

export function useNewAuth() {
  const context = useContext(NewAuthContext)
  if (context === undefined) {
    throw new Error('useNewAuth must be used within a NewAuthProvider')
  }
  return context
} 