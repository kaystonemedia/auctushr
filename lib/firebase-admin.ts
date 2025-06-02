import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

// Initialize Firebase Admin if it hasn't been initialized
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

// Export initialized instances
export const adminAuth = getAuth()
export const adminDb = getFirestore()

// Helper function to verify session cookie
export async function verifySessionCookie(sessionCookie: string) {
  try {
    const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true)
    return decodedToken
  } catch (error) {
    console.error('Error verifying session cookie:', error)
    throw error
  }
}

// Helper function to create session cookie
export async function createSessionCookie(idToken: string, expiresIn: number) {
  try {
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn })
    return sessionCookie
  } catch (error) {
    console.error('Error creating session cookie:', error)
    throw error
  }
}

// Helper function to revoke session cookie
export async function revokeSessionCookie(sessionCookie: string) {
  try {
    await adminAuth.revokeRefreshTokens(await adminAuth.verifySessionCookie(sessionCookie))
  } catch (error) {
    console.error('Error revoking session cookie:', error)
    throw error
  }
}

export function getAdminAuth() {
  return adminAuth;
}

export function getAdminDb() {
  return adminDb;
} 