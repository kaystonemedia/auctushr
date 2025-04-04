'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface User {
  id: string
  name: string
  email: string
  // Add other user properties as needed
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  signup: (email: string, password: string, name: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for existing session/token here
    // For now, we'll just set loading to false
    setLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    // Implement login logic here
    // For now, we'll just set a mock user
    setUser({
      id: '1',
      name: 'Test User',
      email: email
    })
  }

  const logout = async () => {
    // Implement logout logic here
    setUser(null)
  }

  const signup = async (email: string, password: string, name: string) => {
    // Implement signup logic here
    // For now, we'll just set a mock user
    setUser({
      id: '1',
      name: name,
      email: email
    })
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, signup }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
} 