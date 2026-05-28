'use client'
/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  supabaseClient as supabase,
  resetSupabaseSessionTokenCache,
  primeSupabaseSessionToken
} from '@/lib/supabase/client'
import {
  clearCurrentIdentity,
  setCurrentIdentity
} from './identity'

export type User = {
  uid: string
  email: string
  emailVerified: boolean
  getIdToken: () => Promise<string>
}

type AuthStateListener = (user: User | null) => void

type AuthObject = {
  currentUser: User | null
}

const listeners = new Set<AuthStateListener>()

export const browserLocalPersistence = { mode: 'local' } as const

const auth: AuthObject = {
  currentUser: null
}

async function getSessionToken(): Promise<string> {
  const response = await fetch('/api/auth/token', { cache: 'no-store' })
  if (!response.ok) {
    throw new Error('Unable to fetch session token')
  }
  const payload = await response.json()
  return payload.token
}

function toCompatUser(user: { id: string; email?: string | null; email_confirmed_at?: string | null }): User {
  return {
    uid: user.id,
    email: user.email || '',
    emailVerified: Boolean(user.email_confirmed_at),
    getIdToken: getSessionToken
  }
}

function notifyListeners() {
  for (const listener of listeners) {
    listener(auth.currentUser)
  }
}

async function refreshCurrentUser() {
  const response = await fetch('/api/auth/me', { cache: 'no-store' })
  if (!response.ok) {
    auth.currentUser = null
    clearCurrentIdentity()
    notifyListeners()
    return
  }

  const payload = await response.json()
  if (payload?.user?.uid) {
    auth.currentUser = {
      uid: payload.user.uid,
      email: payload.user.email || '',
      emailVerified: true,
      getIdToken: getSessionToken
    }
    if (payload.user.id) {
      setCurrentIdentity({
        authUid: String(payload.user.uid),
        profileId: String(payload.user.id)
      })
    }
  } else {
    auth.currentUser = null
    clearCurrentIdentity()
  }
  notifyListeners()
}

void refreshCurrentUser()

export function getAuth() {
  return auth
}

export function setPersistence(_auth: AuthObject, _persistence: unknown) {
  return Promise.resolve()
}

export function onAuthStateChanged(_auth: AuthObject, listener: AuthStateListener) {
  listeners.add(listener)
  listener(auth.currentUser)
  void refreshCurrentUser()
  return () => {
    listeners.delete(listener)
  }
}

export async function signInWithEmailAndPassword(_auth: AuthObject, email: string, password: string) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error || 'Invalid credentials')
  }
  resetSupabaseSessionTokenCache()
  await primeSupabaseSessionToken()
  await refreshCurrentUser()
  if (!auth.currentUser) {
    throw new Error('Unable to hydrate user session')
  }
  return { user: auth.currentUser }
}

export async function createUserWithEmailAndPassword(_auth: AuthObject, email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  })
  if (error || !data.user) {
    throw new Error(error?.message || 'Unable to create user')
  }
  const compatUser = toCompatUser(data.user)
  auth.currentUser = compatUser
  notifyListeners()
  return { user: compatUser }
}

export async function signOut(_auth: AuthObject) {
  await fetch('/api/auth/logout', { method: 'POST' })
  auth.currentUser = null
  resetSupabaseSessionTokenCache()
  clearCurrentIdentity()
  notifyListeners()
}

export async function sendPasswordResetEmail(_auth: AuthObject, email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email)
  if (error) {
    throw new Error(error.message)
  }
}

export async function updatePassword(_user: User, newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) {
    throw new Error(error.message)
  }
}

export async function fetchSignInMethodsForEmail(_auth: AuthObject, email: string): Promise<string[]> {
  const response = await fetch(`/api/auth/preflight?email=${encodeURIComponent(email)}`, { cache: 'no-store' })
  if (!response.ok) return []
  const payload = await response.json()
  if (!payload?.exists) return []
  return payload.hasPassword ? ['password'] : []
}

export async function signInWithCustomToken(_auth: AuthObject, _token: string) {
  resetSupabaseSessionTokenCache()
  await refreshCurrentUser()
  if (!auth.currentUser) {
    throw new Error('Unable to authenticate with custom token')
  }
  return { user: auth.currentUser }
}

