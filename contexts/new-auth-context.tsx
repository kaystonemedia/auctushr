'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { useRouter, usePathname } from 'next/navigation'
import { UserRole } from '@/types/user'

interface User {
  id: string
  uid: string
  email: string
  name: string
  role: UserRole
  department?: string
  position?: string
  managerId?: string | null
  phone?: string
  mobileNumber?: string | null
  ssnitNumber?: string | null
  bankAccount?: {
    accountNumber?: string
    bankCode?: string
    accountName?: string
    bankName?: string
    branch?: string
  } | null
  emergencyContact?: {
    name?: string
    relationship?: string
    phone?: string
  } | null
  avatar?: string
  createdAt?: Date
  updatedAt?: Date
  requiresPasswordChange: boolean
}

interface LegacyFirebaseUser {
  uid: string
  email: string
  getIdToken: () => Promise<string>
}

interface AuthContextType {
  user: User | null
  firebaseUser: LegacyFirebaseUser | null
  isLoading: boolean
  error: string | null
  login: (email: string, password: string, isPasswordSetup?: boolean, inviteToken?: string) => Promise<void>
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

const roleBasedRoutes = {
  admin: ['/dashboard', '/profile', '/employees', '/attendance', '/leave', '/payroll', '/payslip', '/documents', '/productivity', '/performance', '/settings', '/help', '/support', '/managers', '/administrators', '/tasks', '/departments', '/wellness-check-in', '/whos-away', '/test-auth', '/add-employee', '/todo', '/debug-assignments', '/fix-assignments', '/tools', '/toolkit', '/monitoring'],
  manager: ['/dashboard', '/profile', '/employees', '/attendance', '/leave', '/payroll', '/payslip', '/documents', '/productivity', '/performance', '/settings', '/help', '/support', '/tasks', '/departments', '/wellness-check-in', '/whos-away', '/test-auth', '/debug-assignments', '/fix-assignments', '/tools', '/toolkit', '/monitoring'],
  employee: ['/dashboard', '/profile', '/attendance', '/my-tasks', '/leave', '/payslip', '/help', '/support', '/test-auth', '/debug-assignments', '/fix-assignments', '/tools', '/toolkit']
}

async function fetchCurrentUser(): Promise<User | null> {
  const response = await fetch('/api/auth/me', { cache: 'no-store' })
  if (!response.ok) return null
  const payload = await response.json()
  return payload.user || null
}

async function fetchSessionToken(): Promise<string> {
  const response = await fetch('/api/auth/token', { cache: 'no-store' })
  if (!response.ok) {
    throw new Error('Unable to fetch session token')
  }
  const payload = await response.json()
  return payload.token
}

export function NewAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false)

  useEffect(() => {
    let isMounted = true
    const hydrateUser = async () => {
      try {
        const currentUser = await fetchCurrentUser()
        if (!isMounted) return
        setUser(currentUser)
        setRequiresPasswordChange(Boolean(currentUser?.requiresPasswordChange))
      } catch (hydrateError) {
        console.error('Failed to hydrate auth session:', hydrateError)
        if (isMounted) setUser(null)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }
    hydrateUser()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (isLoading) return
    if (pathname?.startsWith('/auth/') && user) {
      router.push('/dashboard')
      return
    }
    if (!pathname?.startsWith('/auth/') && !user) {
      router.push('/auth/sign-in')
      return
    }
    if (user && !pathname?.startsWith('/auth/')) {
      if (pathname === '/unauthorized' || pathname === '/test-auth') return
      if (pathname === '/') {
        router.push('/dashboard')
        return
      }
      const allowedRoutes = roleBasedRoutes[user.role as keyof typeof roleBasedRoutes]
      if (allowedRoutes && !allowedRoutes.some((route) => pathname?.startsWith(route))) {
        router.push('/unauthorized')
      }
    }
  }, [user, isLoading, pathname, router])

  const login = async (email: string, password: string, isPasswordSetup = false, inviteToken?: string) => {
    try {
      setIsLoading(true)
      setError(null)

      if (isPasswordSetup) {
        const setupResponse = await fetch('/api/auth/first-time-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, inviteToken })
        })
        const setupPayload = await setupResponse.json()
        if (!setupResponse.ok) {
          throw new Error(setupPayload.error || 'Failed to set password')
        }
      }

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const payload = await response.json()
      if (!response.ok) {
        const code = payload.error || 'Failed to sign in'
        if (code === 'ACCOUNT_NOT_INITIALIZED') {
          throw new Error('ACCOUNT_NOT_INITIALIZED')
        }
        throw new Error(code)
      }

      const currentUser = await fetchCurrentUser()
      if (!currentUser) {
        throw new Error('User profile not found')
      }

      setUser(currentUser)
      setRequiresPasswordChange(Boolean(currentUser.requiresPasswordChange))

      if (currentUser.requiresPasswordChange && !isPasswordSetup) {
        router.push('/auth/change-password')
      } else {
        router.push('/dashboard')
      }
    } catch (loginError) {
      if (
        loginError instanceof Error &&
        loginError.message === 'ACCOUNT_NOT_INITIALIZED'
      ) {
        throw loginError
      }
      const normalized = loginError instanceof Error ? loginError.message : 'Failed to sign in'
      setError(normalized)
      throw loginError
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    try {
      setIsLoading(true)
      await fetch('/api/auth/logout', { method: 'POST' })
      setUser(null)
      setRequiresPasswordChange(false)
      toast.success('Successfully signed out')
      router.push('/auth/sign-in')
    } catch (logoutError) {
      console.error('Logout error:', logoutError)
      setError('Failed to sign out')
      toast.error('Failed to sign out')
      throw logoutError
    } finally {
      setIsLoading(false)
    }
  }

  const updateUser = async (data: Partial<User>) => {
    const response = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}))
      throw new Error(errorPayload.error || 'Failed to update profile')
    }
    const payload = await response.json()
    setUser((prev) => (prev ? { ...prev, ...payload.user } : payload.user))
  }

  const firebaseUser: LegacyFirebaseUser | null = user
    ? {
        uid: user.uid,
        email: user.email,
        getIdToken: fetchSessionToken
      }
    : null

  return (
    <NewAuthContext.Provider
      value={{
        user,
        firebaseUser,
        isLoading,
        error,
        login,
        logout,
        updateUser,
        requiresPasswordChange
      }}
    >
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

/*
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { useRouter, usePathname } from 'next/navigation'
import { UserRole } from '@/types/user'

interface User {
  id: string
  uid: string
  email: string
  name: string
  role: UserRole
  department?: string
  position?: string
  managerId?: string | null
  phone?: string
  mobileNumber?: string | null
  bankAccount?: {
    accountNumber?: string
    bankCode?: string
    accountName?: string
  } | null
  emergencyContact?: {
    name?: string
    relationship?: string
    phone?: string
  } | null
  avatar?: string
  createdAt?: Date
  updatedAt?: Date
  requiresPasswordChange: boolean
}

interface LegacyFirebaseUser {
  uid: string
  email: string
  getIdToken: () => Promise<string>
}

interface AuthContextType {
  user: User | null
  firebaseUser: LegacyFirebaseUser | null
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

const roleBasedRoutes = {
  admin: ['/dashboard', '/profile', '/employees', '/attendance', '/leave', '/payroll', '/payslip', '/documents', '/productivity', '/performance', '/settings', '/help', '/support', '/managers', '/administrators', '/tasks', '/departments', '/wellness-check-in', '/whos-away', '/test-auth', '/add-employee', '/todo', '/debug-assignments', '/fix-assignments', '/tools', '/toolkit', '/monitoring'],
  manager: ['/dashboard', '/profile', '/employees', '/attendance', '/leave', '/payroll', '/payslip', '/documents', '/productivity', '/performance', '/settings', '/help', '/support', '/tasks', '/departments', '/wellness-check-in', '/whos-away', '/test-auth', '/debug-assignments', '/fix-assignments', '/tools', '/toolkit', '/monitoring'],
  employee: ['/dashboard', '/profile', '/attendance', '/my-tasks', '/leave', '/payslip', '/help', '/support', '/test-auth', '/debug-assignments', '/fix-assignments', '/tools', '/toolkit']
}

async function fetchCurrentUser(): Promise<User | null> {
  const response = await fetch('/api/auth/me', { cache: 'no-store' })
  if (!response.ok) return null
  const payload = await response.json()
  return payload.user || null
}

async function fetchSessionToken(): Promise<string> {
  const response = await fetch('/api/auth/token', { cache: 'no-store' })
  if (!response.ok) {
    throw new Error('Unable to fetch session token')
  }
  const payload = await response.json()
  return payload.token
}

export function NewAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false)

  useEffect(() => {
    let isMounted = true
    const hydrateUser = async () => {
      try {
        const currentUser = await fetchCurrentUser()
        if (!isMounted) return
        setUser(currentUser)
        setRequiresPasswordChange(Boolean(currentUser?.requiresPasswordChange))
      } catch (hydrateError) {
        console.error('Failed to hydrate auth session:', hydrateError)
        if (isMounted) setUser(null)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }
    hydrateUser()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (isLoading) return
    if (pathname?.startsWith('/auth/') && user) {
      router.push('/dashboard')
      return
    }
    if (!pathname?.startsWith('/auth/') && !user) {
      router.push('/auth/sign-in')
      return
    }
    if (user && !pathname?.startsWith('/auth/')) {
      if (pathname === '/unauthorized' || pathname === '/test-auth') return
      if (pathname === '/') {
        router.push('/dashboard')
        return
      }
      const allowedRoutes = roleBasedRoutes[user.role as keyof typeof roleBasedRoutes]
      if (allowedRoutes && !allowedRoutes.some((route) => pathname?.startsWith(route))) {
        router.push('/unauthorized')
      }
    }
  }, [user, isLoading, pathname, router])

  const login = async (email: string, password: string, isPasswordSetup = false) => {
    try {
      setIsLoading(true)
      setError(null)

      if (isPasswordSetup) {
        const setupResponse = await fetch('/api/auth/first-time-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        })
        const setupPayload = await setupResponse.json()
        if (!setupResponse.ok) {
          throw new Error(setupPayload.error || 'Failed to set password')
        }
      }

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const payload = await response.json()
      if (!response.ok) {
        const code = payload.error || 'Failed to sign in'
        if (code === 'ACCOUNT_NOT_INITIALIZED') {
          throw new Error('ACCOUNT_NOT_INITIALIZED')
        }
        throw new Error(code)
      }

      const currentUser = await fetchCurrentUser()
      if (!currentUser) {
        throw new Error('User profile not found')
      }

      setUser(currentUser)
      setRequiresPasswordChange(Boolean(currentUser.requiresPasswordChange))

      if (currentUser.requiresPasswordChange && !isPasswordSetup) {
        router.push('/auth/change-password')
      } else {
        router.push('/dashboard')
      }
    } catch (loginError) {
      if (
        loginError instanceof Error &&
        loginError.message === 'ACCOUNT_NOT_INITIALIZED'
      ) {
        throw loginError
      }
      const normalized = loginError instanceof Error ? loginError.message : 'Failed to sign in'
      setError(normalized)
      throw loginError
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    try {
      setIsLoading(true)
      await fetch('/api/auth/logout', { method: 'POST' })
      setUser(null)
      setRequiresPasswordChange(false)
      toast.success('Successfully signed out')
      router.push('/auth/sign-in')
    } catch (logoutError) {
      console.error('Logout error:', logoutError)
      setError('Failed to sign out')
      toast.error('Failed to sign out')
      throw logoutError
    } finally {
      setIsLoading(false)
    }
  }

  const updateUser = async (data: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...data, updatedAt: new Date() } : prev))
  }

  const firebaseUser: LegacyFirebaseUser | null = user
    ? {
        uid: user.uid,
        email: user.email,
        getIdToken: fetchSessionToken
      }
    : null

  return (
    <NewAuthContext.Provider
      value={{
        user,
        firebaseUser,
        isLoading,
        error,
        login,
        logout,
        updateUser,
        requiresPasswordChange
      }}
    >
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

'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { useRouter, usePathname } from 'next/navigation'
import { UserRole } from '@/types/user'

interface User {
  id: string
  uid: string
  email: string
  name: string
  role: UserRole
  department?: string
  position?: string
  managerId?: string | null
  phone?: string
  mobileNumber?: string | null
  bankAccount?: {
    accountNumber?: string
    bankCode?: string
    accountName?: string
  } | null
  emergencyContact?: {
    name?: string
    relationship?: string
    phone?: string
  } | null
  avatar?: string
  createdAt?: Date
  updatedAt?: Date
  requiresPasswordChange: boolean
}

interface LegacyFirebaseUser {
  uid: string
  email: string
  getIdToken: () => Promise<string>
}

interface AuthContextType {
  user: User | null
  firebaseUser: LegacyFirebaseUser | null
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

const roleBasedRoutes = {
  admin: ['/dashboard', '/profile', '/employees', '/attendance', '/leave', '/payroll', '/payslip', '/documents', '/productivity', '/performance', '/settings', '/help', '/support', '/managers', '/administrators', '/tasks', '/departments', '/wellness-check-in', '/whos-away', '/test-auth', '/add-employee', '/todo', '/debug-assignments', '/fix-assignments', '/tools', '/toolkit', '/monitoring'],
  manager: ['/dashboard', '/profile', '/employees', '/attendance', '/leave', '/payroll', '/payslip', '/documents', '/productivity', '/performance', '/settings', '/help', '/support', '/tasks', '/departments', '/wellness-check-in', '/whos-away', '/test-auth', '/debug-assignments', '/fix-assignments', '/tools', '/toolkit', '/monitoring'],
  employee: ['/dashboard', '/profile', '/attendance', '/my-tasks', '/leave', '/payslip', '/help', '/support', '/test-auth', '/debug-assignments', '/fix-assignments', '/tools', '/toolkit']
}

async function fetchCurrentUser(): Promise<User | null> {
  const response = await fetch('/api/auth/me', { cache: 'no-store' })
  if (!response.ok) return null
  const payload = await response.json()
  return payload.user || null
}

async function fetchSessionToken(): Promise<string> {
  const response = await fetch('/api/auth/token', { cache: 'no-store' })
  if (!response.ok) {
    throw new Error('Unable to fetch session token')
  }
  const payload = await response.json()
  return payload.token
}

export function NewAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false)

  useEffect(() => {
    let isMounted = true
    const hydrateUser = async () => {
      try {
        const currentUser = await fetchCurrentUser()
        if (!isMounted) return
        setUser(currentUser)
        setRequiresPasswordChange(Boolean(currentUser?.requiresPasswordChange))
      } catch (hydrateError) {
        console.error('Failed to hydrate auth session:', hydrateError)
        if (isMounted) setUser(null)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }
    hydrateUser()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (isLoading) return
    if (pathname?.startsWith('/auth/') && user) {
      router.push('/dashboard')
      return
    }
    if (!pathname?.startsWith('/auth/') && !user) {
      router.push('/auth/sign-in')
      return
    }
    if (user && !pathname?.startsWith('/auth/')) {
      if (pathname === '/unauthorized' || pathname === '/test-auth') return
      if (pathname === '/') {
        router.push('/dashboard')
        return
      }
      const allowedRoutes = roleBasedRoutes[user.role as keyof typeof roleBasedRoutes]
      if (allowedRoutes && !allowedRoutes.some((route) => pathname?.startsWith(route))) {
        router.push('/unauthorized')
      }
    }
  }, [user, isLoading, pathname, router])

  const login = async (email: string, password: string, isPasswordSetup = false) => {
    try {
      setIsLoading(true)
      setError(null)

      if (isPasswordSetup) {
        const setupResponse = await fetch('/api/auth/first-time-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        })
        const setupPayload = await setupResponse.json()
        if (!setupResponse.ok) {
          throw new Error(setupPayload.error || 'Failed to set password')
        }
      }

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const payload = await response.json()
      if (!response.ok) {
        const code = payload.error || 'Failed to sign in'
        if (code === 'ACCOUNT_NOT_INITIALIZED') {
          throw new Error('ACCOUNT_NOT_INITIALIZED')
        }
        throw new Error(code)
      }

      const currentUser = await fetchCurrentUser()
      if (!currentUser) {
        throw new Error('User profile not found')
      }

      setUser(currentUser)
      setRequiresPasswordChange(Boolean(currentUser.requiresPasswordChange))

      if (currentUser.requiresPasswordChange && !isPasswordSetup) {
        router.push('/auth/change-password')
      } else {
        router.push('/dashboard')
      }
    } catch (loginError) {
      if (
        loginError instanceof Error &&
        loginError.message === 'ACCOUNT_NOT_INITIALIZED'
      ) {
        throw loginError
      }
      const normalized = loginError instanceof Error ? loginError.message : 'Failed to sign in'
      setError(normalized)
      throw loginError
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    try {
      setIsLoading(true)
      await fetch('/api/auth/logout', { method: 'POST' })
      setUser(null)
      setRequiresPasswordChange(false)
      toast.success('Successfully signed out')
      router.push('/auth/sign-in')
    } catch (logoutError) {
      console.error('Logout error:', logoutError)
      setError('Failed to sign out')
      toast.error('Failed to sign out')
      throw logoutError
    } finally {
      setIsLoading(false)
    }
  }

  const updateUser = async (data: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...data, updatedAt: new Date() } : prev))
  }

  const firebaseUser: LegacyFirebaseUser | null = user
    ? {
        uid: user.uid,
        email: user.email,
        getIdToken: fetchSessionToken
      }
    : null

  return (
    <NewAuthContext.Provider
      value={{
        user,
        firebaseUser,
        isLoading,
        error,
        login,
        logout,
        updateUser,
        requiresPasswordChange
      }}
    >
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

/*
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { useRouter, usePathname } from 'next/navigation'
import { UserRole } from '@/types/user'

interface User {
  id: string
  uid: string
  email: string
  name: string
  role: UserRole
  department?: string
  position?: string
  managerId?: string | null
  phone?: string
  mobileNumber?: string | null
  bankAccount?: {
    accountNumber?: string
    bankCode?: string
    accountName?: string
  } | null
  emergencyContact?: {
    name?: string
    relationship?: string
    phone?: string
  } | null
  avatar?: string
  createdAt?: Date
  updatedAt?: Date
  requiresPasswordChange: boolean
}

interface AuthContextType {
  user: User | null
  firebaseUser: null
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

const roleBasedRoutes = {
  admin: [
    '/dashboard', '/profile', '/employees', '/attendance', '/attendance/reports', '/attendance/settings',
    '/leave', '/payroll', '/payslip', '/documents', '/productivity', '/performance', '/settings', '/help',
    '/support', '/managers', '/administrators', '/tasks', '/departments', '/wellness-check-in', '/whos-away',
    '/test-auth', '/add-employee', '/todo', '/debug-assignments', '/fix-assignments', '/tools', '/monitoring'
  ],
  manager: [
    '/dashboard', '/profile', '/employees', '/attendance', '/attendance/reports', '/leave', '/payroll',
    '/payslip', '/documents', '/productivity', '/performance', '/settings', '/help', '/support', '/tasks',
    '/departments', '/wellness-check-in', '/whos-away', '/test-auth', '/debug-assignments', '/fix-assignments',
    '/tools', '/monitoring'
  ],
  employee: [
    '/dashboard', '/profile', '/attendance', '/my-tasks', '/leave', '/payslip', '/help', '/support',
    '/test-auth', '/debug-assignments', '/fix-assignments', '/tools'
  ]
}

async function fetchCurrentUser(): Promise<User | null> {
  const response = await fetch('/api/auth/me', { cache: 'no-store' })
  if (!response.ok) return null
  const payload = await response.json()
  return payload.user || null
}

export function NewAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false)

  useEffect(() => {
    let isMounted = true
    const hydrateUser = async () => {
      try {
        const currentUser = await fetchCurrentUser()
        if (!isMounted) return
        setUser(currentUser)
        setRequiresPasswordChange(Boolean(currentUser?.requiresPasswordChange))
      } catch (hydrateError) {
        console.error('Failed to hydrate auth session:', hydrateError)
        if (isMounted) {
          setUser(null)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }
    hydrateUser()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (isLoading) return
    if (pathname?.startsWith('/auth/') && user) {
      router.push('/dashboard')
      return
    }
    if (!pathname?.startsWith('/auth/') && !user) {
      router.push('/auth/sign-in')
      return
    }
    if (user && !pathname?.startsWith('/auth/')) {
      if (pathname === '/unauthorized') return
      if (pathname === '/') {
        router.push('/dashboard')
        return
      }
      if (pathname === '/test-auth') return
      const allowedRoutes = roleBasedRoutes[user.role as keyof typeof roleBasedRoutes]
      if (allowedRoutes && !allowedRoutes.some((route) => pathname?.startsWith(route))) {
        router.push('/unauthorized')
      }
    }
  }, [user, isLoading, pathname, router])

  const login = async (email: string, password: string, isPasswordSetup = false) => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to sign in')
      }

      const currentUser = await fetchCurrentUser()
      if (!currentUser) {
        throw new Error('User profile not found')
      }

      setUser(currentUser)
      setRequiresPasswordChange(Boolean(currentUser.requiresPasswordChange))

      try {
        await fetch('/api/auth/track-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            userName: currentUser.name,
            action: 'login',
            loginTime: new Date().toISOString()
          })
        })
      } catch (trackError) {
        console.error('Error tracking login:', trackError)
      }

      if (currentUser.requiresPasswordChange && !isPasswordSetup) {
        router.push('/auth/change-password')
      } else {
        router.push('/dashboard')
      }
    } catch (loginError) {
      const normalizedError = loginError instanceof Error ? loginError.message : 'Failed to sign in'
      setError(normalizedError)
      throw loginError
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    try {
      setIsLoading(true)
      if (user) {
        try {
          await fetch('/api/auth/track-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              userName: user.name,
              action: 'logout',
              logoutTime: new Date().toISOString()
            })
          })
        } catch (trackError) {
          console.error('Error tracking logout:', trackError)
        }
      }

      await fetch('/api/auth/logout', { method: 'POST' })
      setUser(null)
      setRequiresPasswordChange(false)
      toast.success('Successfully signed out')
      router.push('/auth/sign-in')
    } catch (logoutError) {
      console.error('Logout error:', logoutError)
      setError('Failed to sign out')
      toast.error('Failed to sign out')
      throw logoutError
    } finally {
      setIsLoading(false)
    }
  }

  const updateUser = async (data: Partial<User>) => {
    setUser((prev) => prev ? { ...prev, ...data, updatedAt: new Date() } : prev)
  }

  return (
    <NewAuthContext.Provider
      value={{
        user,
        firebaseUser: null,
        isLoading,
        error,
        login,
        logout,
        updateUser,
        requiresPasswordChange
      }}
    >
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
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { useRouter, usePathname } from 'next/navigation'
import { UserRole } from '@/types/user'

interface User {
  id: string
  uid: string
  email: string
  name: string
  role: UserRole
  department?: string
  position?: string
  managerId?: string | null
  phone?: string
  mobileNumber?: string | null
  bankAccount?: {
    accountNumber?: string
    bankCode?: string
    accountName?: string
  } | null
  emergencyContact?: {
    name?: string
    relationship?: string
    phone?: string
  } | null
  avatar?: string
  createdAt?: Date
  updatedAt?: Date
  requiresPasswordChange: boolean
}

interface AuthContextType {
  user: User | null
  firebaseUser: null
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

const roleBasedRoutes = {
  admin: [
    '/dashboard', '/profile', '/employees', '/attendance', '/attendance/reports', '/attendance/settings',
    '/leave', '/payroll', '/payslip', '/documents', '/productivity', '/performance', '/settings', '/help',
    '/support', '/managers', '/administrators', '/tasks', '/departments', '/wellness-check-in', '/whos-away',
    '/test-auth', '/add-employee', '/todo', '/debug-assignments', '/fix-assignments', '/tools', '/monitoring'
  ],
  manager: [
    '/dashboard', '/profile', '/employees', '/attendance', '/attendance/reports', '/leave', '/payroll',
    '/payslip', '/documents', '/productivity', '/performance', '/settings', '/help', '/support', '/tasks',
    '/departments', '/wellness-check-in', '/whos-away', '/test-auth', '/debug-assignments', '/fix-assignments',
    '/tools', '/monitoring'
  ],
  employee: [
    '/dashboard', '/profile', '/attendance', '/my-tasks', '/leave', '/payslip', '/help', '/support',
    '/test-auth', '/debug-assignments', '/fix-assignments', '/tools'
  ]
}

async function fetchCurrentUser(): Promise<User | null> {
  const response = await fetch('/api/auth/me', { cache: 'no-store' })
  if (!response.ok) return null
  const payload = await response.json()
  return payload.user || null
}

export function NewAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false)

  useEffect(() => {
    let isMounted = true
    const hydrateUser = async () => {
      try {
        const currentUser = await fetchCurrentUser()
        if (!isMounted) return
        setUser(currentUser)
        setRequiresPasswordChange(Boolean(currentUser?.requiresPasswordChange))
      } catch (hydrateError) {
        console.error('Failed to hydrate auth session:', hydrateError)
        if (isMounted) {
          setUser(null)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }
    hydrateUser()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (isLoading) return
    if (pathname?.startsWith('/auth/') && user) {
      router.push('/dashboard')
      return
    }
    if (!pathname?.startsWith('/auth/') && !user) {
      router.push('/auth/sign-in')
      return
    }
    if (user && !pathname?.startsWith('/auth/')) {
      if (pathname === '/unauthorized') return
      if (pathname === '/') {
        router.push('/dashboard')
        return
      }
      if (pathname === '/test-auth') return
      const allowedRoutes = roleBasedRoutes[user.role as keyof typeof roleBasedRoutes]
      if (allowedRoutes && !allowedRoutes.some((route) => pathname?.startsWith(route))) {
        router.push('/unauthorized')
      }
    }
  }, [user, isLoading, pathname, router])

  const login = async (email: string, password: string, isPasswordSetup = false) => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to sign in')
      }

      const currentUser = await fetchCurrentUser()
      if (!currentUser) {
        throw new Error('User profile not found')
      }

      setUser(currentUser)
      setRequiresPasswordChange(Boolean(currentUser.requiresPasswordChange))

      try {
        await fetch('/api/auth/track-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            userName: currentUser.name,
            action: 'login',
            loginTime: new Date().toISOString()
          })
        })
      } catch (trackError) {
        console.error('Error tracking login:', trackError)
      }

      if (currentUser.requiresPasswordChange && !isPasswordSetup) {
        router.push('/auth/change-password')
      } else {
        router.push('/dashboard')
      }
    } catch (loginError) {
      const normalizedError = loginError instanceof Error ? loginError.message : 'Failed to sign in'
      setError(normalizedError)
      throw loginError
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    try {
      setIsLoading(true)
      if (user) {
        try {
          await fetch('/api/auth/track-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              userName: user.name,
              action: 'logout',
              logoutTime: new Date().toISOString()
            })
          })
        } catch (trackError) {
          console.error('Error tracking logout:', trackError)
        }
      }

      await fetch('/api/auth/logout', { method: 'POST' })
      setUser(null)
      setRequiresPasswordChange(false)
      toast.success('Successfully signed out')
      router.push('/auth/sign-in')
    } catch (logoutError) {
      console.error('Logout error:', logoutError)
      setError('Failed to sign out')
      toast.error('Failed to sign out')
      throw logoutError
    } finally {
      setIsLoading(false)
    }
  }

  const updateUser = async (data: Partial<User>) => {
    setUser((prev) => prev ? { ...prev, ...data, updatedAt: new Date() } : prev)
  }

  return (
    <NewAuthContext.Provider
      value={{
        user,
        firebaseUser: null,
        isLoading,
        error,
        login,
        logout,
        updateUser,
        requiresPasswordChange
      }}
    >
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
*/
/*
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { auth, db } from '@/lib/_legacy_firebase'
import { onAuthStateChanged, signOut as firebaseSignOut, User as FirebaseUser } from 'firebase/_auth'
import { doc, getDoc, collection, query, where, limit, getDocs, updateDoc } from 'firebase/_firestore'
import { toast } from 'react-hot-toast'
import { useRouter, usePathname } from 'next/navigation'
import { signIn } from '@/lib/_legacy_firebase'
import { UserRole } from '@/types/user'

interface User {
  id: string
  firestoreId?: string
  collection?: 'users' | 'employees' | 'managers'
  email: string
  name: string
  role: UserRole
  department?: string
  position?: string
  managerId?: string | null
  phone?: string
  mobileNumber?: string | null
  bankAccount?: {
    accountNumber?: string
    bankCode?: string
    accountName?: string
  } | null
  emergencyContact?: {
    name?: string
    relationship?: string
    phone?: string
  } | null
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
    '/payslip',
    '/documents',
    '/productivity',
    '/performance',
    '/settings',
    '/help',
    '/support',
    '/managers',
    '/administrators',
    '/tasks',
    '/departments',
    '/wellness-check-in',
    '/whos-away',
    '/test-auth',
    '/add-employee',
    '/todo',
    '/debug-assignments',
    '/fix-assignments',
    '/tools',
    '/monitoring'
  ],
  manager: [
    '/dashboard',
    '/profile',
    '/employees',
    '/attendance',
    '/attendance/reports',
    '/leave',
    '/payroll',
    '/payslip',
    '/documents',
    '/productivity',
    '/performance',
    '/settings',
    '/help',
    '/support',
    '/tasks',
    '/departments',
    '/wellness-check-in',
    '/whos-away',
    '/test-auth',
    '/debug-assignments',
    '/fix-assignments',
    '/tools',
    '/monitoring'
  ],
  employee: [
    '/dashboard',
    '/profile',
    '/attendance',
    '/my-tasks',
    '/leave',
    '/payslip',
    '/help',
    '/support',
    '/test-auth',
    '/debug-assignments',
    '/fix-assignments',
    '/tools'
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
        // Allow the unauthorized page itself to render so we don't loop
        if (pathname === '/unauthorized') {
          return
        }

        // Treat the root path as a shortcut to the dashboard
        if (pathname === '/') {
          router.push('/dashboard')
          return
        }

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

          // Get user data from Firestore by querying uid field
          console.log('Fetching user data for:', firebaseUser.uid)
          let userDoc = null;
          let userData: Record<string, unknown> | null = null;

          // Try users collection by uid
          const userQuery = query(
            collection(db, 'users'),
            where('uid', '==', firebaseUser.uid),
            limit(1)
          );
          const userSnap = await getDocs(userQuery);
          if (!userSnap.empty) {
            userDoc = userSnap.docs[0];
            userData = userDoc.data() as Record<string, unknown>;
            if (userData) {
              userData.name = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
              userData.role = userData.role || 'admin';
            }
          }

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
            // Try employees collection by email (for first-time login)
            console.log("Checking for employee document by email for first-time login");
            const employeeByEmailQuery = query(
              collection(db, 'employees'),
              where('email', '==', firebaseUser.email),
              where('uid', '==', null),
              where('hasPassword', '==', false),
              limit(1)
            );
            const employeeByEmailSnap = await getDocs(employeeByEmailQuery);
            if (!employeeByEmailSnap.empty) {
              console.log("Found employee document for first-time login, updating with UID");
              userDoc = employeeByEmailSnap.docs[0];
              userData = userDoc.data() as Record<string, unknown>;
              
              // Update the employee document with the Firebase UID
              await updateDoc(userDoc.ref, {
                uid: firebaseUser.uid,
                hasPassword: true,
                requiresPasswordChange: true,
                updatedAt: new Date()
              });
              
              if (userData) {
                userData.name = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
                userData.role = 'employee';
                userData.requiresPasswordChange = true;
                userData.hasPassword = true;
                userData.uid = firebaseUser.uid;
              }
            }
          }

          if (!userData) {
            // Try managers collection by email (for first-time login)
            console.log("Checking for manager document by email for first-time login");
            const managerByEmailQuery = query(
              collection(db, 'managers'),
              where('email', '==', firebaseUser.email),
              where('uid', '==', null),
              where('hasPassword', '==', false),
              limit(1)
            );
            const managerByEmailSnap = await getDocs(managerByEmailQuery);
            if (!managerByEmailSnap.empty) {
              console.log("Found manager document for first-time login, updating with UID");
              userDoc = managerByEmailSnap.docs[0];
              userData = userDoc.data() as Record<string, unknown>;
              
              // Update the manager document with the Firebase UID
              await updateDoc(userDoc.ref, {
                uid: firebaseUser.uid,
                hasPassword: true,
                requiresPasswordChange: true,
                updatedAt: new Date()
              });
              
              if (userData) {
                userData.name = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
                userData.role = 'manager';
                userData.requiresPasswordChange = true;
                userData.hasPassword = true;
                userData.uid = firebaseUser.uid;
              }
            }
          }

          if (!userData) {
            // Try users collection by email (for administrators first-time login)
            console.log("Checking for user document by email for admin first-time login");
            console.log("Looking for email:", firebaseUser.email);
            
            try {
              const userByEmailQuery = query(
                collection(db, 'users'),
                where('email', '==', firebaseUser.email),
                where('uid', '==', null),
                where('hasPassword', '==', false),
                limit(1)
              );
              const userByEmailSnap = await getDocs(userByEmailQuery);
              console.log("Users collection query results:", userByEmailSnap.docs.length, "documents found");
              
              if (!userByEmailSnap.empty) {
                console.log("Found user document for admin first-time login, updating with UID");
                userDoc = userByEmailSnap.docs[0];
                userData = userDoc.data() as Record<string, unknown>;
                console.log("Admin document data:", userData);
                
                // Update the user document with the Firebase UID
                await updateDoc(userDoc.ref, {
                  uid: firebaseUser.uid,
                  hasPassword: true,
                  requiresPasswordChange: true,
                  updatedAt: new Date()
                });
                
                if (userData) {
                  userData.name = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
                  userData.role = userData.role || 'admin'; // Use existing role or default to admin
                  userData.requiresPasswordChange = true;
                  userData.hasPassword = true;
                  userData.uid = firebaseUser.uid;
                }
              } else {
                // Let's also try a broader search to see if the document exists at all
                console.log("No documents found with strict query, trying broader search...");
                const broadQuery = query(
                  collection(db, 'users'),
                  where('email', '==', firebaseUser.email),
                  limit(1)
                );
                const broadSnap = await getDocs(broadQuery);
                console.log("Broad search results:", broadSnap.docs.length, "documents found");
                if (!broadSnap.empty) {
                  const doc = broadSnap.docs[0];
                  const docData = doc.data();
                  console.log("Found document with email but different conditions:", {
                    hasPassword: docData.hasPassword,
                    uid: docData.uid,
                    role: docData.role
                  });
                }
              }
            } catch (queryError) {
              console.error("Error querying users collection:", queryError);
            }
          }

          if (!userData) {
            console.log("No user document (employee, user, or manager) found for:", firebaseUser.uid);
            setUser({ id: firebaseUser.uid, email: (auth.currentUser?.email || ""), name: "Unknown", role: "employee", createdAt: new Date(), updatedAt: new Date(), requiresPasswordChange: false });
            console.warn("User authenticated (Firebase Auth) but no Firestore document found. (Access denied or restricted page.)");
            return;
          }
          const collectionName = userDoc?.ref.parent.id as 'users' | 'employees' | 'managers' | undefined
          const userObj: User = {
            id: firebaseUser.uid,
            firestoreId: userDoc?.id || undefined,
            collection: collectionName,
            email: typeof userData.email === 'string' ? userData.email : '',
            name: typeof userData.name === 'string' ? userData.name : '',
            role: (typeof userData.role === 'string' && ['admin', 'manager', 'employee'].includes(userData.role)) ? userData.role as UserRole : 'employee',
            department: typeof userData.department === 'string' ? userData.department : undefined,
            position: typeof userData.position === 'string' ? userData.position : undefined,
            managerId: typeof userData.managerId === 'string' ? userData.managerId : null,
            phone: typeof userData.phone === 'string' ? userData.phone : undefined,
            mobileNumber: typeof userData.mobileNumber === 'string' ? userData.mobileNumber : null,
            bankAccount: userData.bankAccount || null,
            emergencyContact: userData.emergencyContact || null,
            avatar: typeof userData.avatar === 'string' ? userData.avatar : undefined,
            createdAt: (userData.createdAt && typeof userData.createdAt === 'object' && 'toDate' in userData.createdAt) ? (userData.createdAt as { toDate: () => Date }).toDate() : new Date(),
            updatedAt: (userData.updatedAt && typeof userData.updatedAt === 'object' && 'toDate' in userData.updatedAt) ? (userData.updatedAt as { toDate: () => Date }).toDate() : new Date(),
            requiresPasswordChange: typeof userData.requiresPasswordChange === 'boolean' ? userData.requiresPasswordChange : false
          };
          
          setUser(userObj);
          
          // Track login
          try {
            await fetch('/api/auth/track-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: firebaseUser.uid,
                userName: userObj.name,
                action: 'login',
                loginTime: new Date().toISOString()
              })
            });
          } catch (error) {
            console.error('Error tracking login:', error);
          }
        } catch (error) {
          console.error('Error setting up session:', error)
          setUser(null)
          await firebaseSignOut(auth)
        }
      } else {
        console.log('No Firebase user, clearing user state')
        // Track logout if user was previously logged in
        if (user) {
          try {
            await fetch('/api/auth/track-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: user.id,
                userName: user.name,
                action: 'logout',
                logoutTime: new Date().toISOString()
              })
            });
          } catch (error) {
            console.error('Error tracking logout:', error);
          }
        }
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
      
      // Get user data from Firestore - query by email across all collections
      console.log('Fetching user data')
      let userDoc = null
      let userData = null
      
      // Try users collection first (for administrators)
      const usersRef = collection(db, 'users')
      const userQuery = query(
        usersRef,
        where('email', '==', email),
        limit(1)
      )
      const userSnapshot = await getDocs(userQuery)
      
      if (userSnapshot.docs.length > 0) {
        userDoc = userSnapshot.docs[0]
        userData = userDoc.data()
      }
      
      // Try managers collection if not found in users
      if (!userDoc?.exists() || !userData) {
        const managersRef = collection(db, 'managers')
        const managerQuery = query(
          managersRef,
          where('email', '==', email),
          limit(1)
        )
        const managerSnapshot = await getDocs(managerQuery)
        
        if (managerSnapshot.docs.length > 0) {
          userDoc = managerSnapshot.docs[0]
          userData = userDoc.data()
        }
      }
      
      // Try employees collection as final fallback
      if (!userDoc?.exists() || !userData) {
        const employeesRef = collection(db, 'employees')
        const employeeQuery = query(
          employeesRef,
          where('email', '==', email),
          limit(1)
        )
        const employeeSnapshot = await getDocs(employeeQuery)
        
        if (employeeSnapshot.docs.length > 0) {
          userDoc = employeeSnapshot.docs[0]
          userData = userDoc.data()
        }
      }
      
      if (!userDoc?.exists() || !userData) {
        console.log('No user document found')
        throw new Error('User profile not found')
      }

      console.log('User data retrieved:', { 
        id: userDoc.id,
        role: userData.role,
        email: userData.email,
        requiresPasswordChange: userData.requiresPasswordChange,
        hasPassword: userData.hasPassword,
        uid: userData.uid
      })

      // Handle first-time login - update the employee document with Firebase UID
      if (!userData.hasPassword && !userData.uid) {
        console.log('First-time login detected, updating employee document with UID')
        await updateDoc(userDoc.ref, {
          uid: user.uid,
          hasPassword: true,
          requiresPasswordChange: true,
          updatedAt: new Date()
        })
        userData.uid = user.uid
        userData.hasPassword = true
        userData.requiresPasswordChange = true
      }

      if (!userData.role) {
        console.log('No role found for user')
        throw new Error('First time login - please set up your profile')
      }

      // Set user state
      const newUser = {
        id: user.uid,
        firestoreId: userDoc.id,
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
      
      // Track logout before signing out
      if (user) {
        try {
          await fetch('/api/auth/track-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              userName: user.name,
              action: 'logout',
              logoutTime: new Date().toISOString()
            })
          });
        } catch (error) {
          console.error('Error tracking logout:', error);
        }
      }
      
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
    if (!user) {
      throw new Error('No authenticated user')
    }

    const collectionName =
      user.collection ||
      (user.role === 'admin'
        ? 'users'
        : user.role === 'manager'
        ? 'managers'
        : 'employees')

    const docId = user.firestoreId || user.id

    try {
      const payload: Record<string, any> = { updatedAt: new Date() }
      Object.entries(data).forEach(([key, value]) => {
        if (value === undefined) {
          return
        }
        payload[key] = value
      })

      await updateDoc(doc(db, collectionName, docId), payload)
      setUser(prev =>
        prev
          ? {
              ...prev,
              ...data,
              updatedAt: payload.updatedAt as Date
            }
          : prev
      )
    } catch (error) {
      console.error('Update user error:', error)
      throw error
    }
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
*/
