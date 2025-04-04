import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'

export function useAuth() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Get the ID token
        const idToken = await firebaseUser.getIdToken()
        
        try {
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

          // Get user data from Firestore
          const userResponse = await fetch('/api/auth/user')
          const userData = await userResponse.json()
          
          setUser(userData)
        } catch (error) {
          console.error('Error setting up session:', error)
          await signOut(auth)
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      return userCredential.user
    } catch (error) {
      console.error('Error signing in:', error)
      throw error
    }
  }

  const logout = async () => {
    try {
      await signOut(auth)
      router.push('/auth/sign-in')
    } catch (error) {
      console.error('Error signing out:', error)
      throw error
    }
  }

  return {
    user,
    loading,
    signIn,
    logout,
  }
} 