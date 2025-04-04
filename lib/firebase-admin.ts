import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const firebaseAdminConfig = {
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
}

let app: any = null
let adminAuth: any = null
let adminDb: any = null

function getAdminApp() {
  if (!app) {
    try {
      app = getApps().length === 0 ? initializeApp(firebaseAdminConfig) : getApps()[0]
    } catch (error) {
      console.error('Error initializing Firebase Admin:', error)
      throw error
    }
  }
  return app
}

export function getAdminAuth() {
  if (!adminAuth) {
    try {
      adminAuth = getAuth(getAdminApp())
    } catch (error) {
      console.error('Error getting Firebase Admin Auth:', error)
      throw error
    }
  }
  return adminAuth
}

export function getAdminDb() {
  if (!adminDb) {
    try {
      adminDb = getFirestore(getAdminApp())
    } catch (error) {
      console.error('Error getting Firebase Admin Firestore:', error)
      throw error
    }
  }
  return adminDb
}

// Helper function to verify session cookie
export async function verifySessionCookie(sessionCookie: string) {
  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idToken: sessionCookie,
      }),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to verify session')
    }
    return data.users[0]
  } catch (error) {
    console.error('Error verifying session cookie:', error)
    throw error
  }
}

// Helper function to create session cookie
export async function createSessionCookie(idToken: string) {
  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: idToken,
        returnSecureToken: true,
      }),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to create session')
    }
    return data.idToken
  } catch (error) {
    console.error('Error creating session cookie:', error)
    throw error
  }
}

// Helper function to revoke session cookie
export async function revokeSessionCookie(sessionCookie: string) {
  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:revokeToken?key=${process.env.FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idToken: sessionCookie,
      }),
    })
    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error?.message || 'Failed to revoke session')
    }
  } catch (error) {
    console.error('Error revoking session cookie:', error)
    throw error
  }
} 