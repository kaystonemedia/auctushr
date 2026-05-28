'use client'

// =============================================================================
// Current-user identity bridge for the Firebase -> Supabase shim
// -----------------------------------------------------------------------------
// Pages that originated against Firestore use `firebaseUser.uid` (= the
// Supabase auth user id) when filtering or writing FK columns that actually
// reference `profiles.id`. To avoid editing every callsite we keep a small
// in-memory mapping from auth uid -> profile id so the shim can transparently
// translate the value before issuing queries.
// =============================================================================

export type CurrentIdentity = {
  authUid: string
  profileId: string
}

let cachedIdentity: CurrentIdentity | null = null
let inflightFetch: Promise<CurrentIdentity | null> | null = null

async function loadIdentity(): Promise<CurrentIdentity | null> {
  if (typeof window === 'undefined') return null
  if (cachedIdentity) return cachedIdentity
  if (inflightFetch) return inflightFetch

  inflightFetch = (async () => {
    try {
      const response = await fetch('/api/auth/me', {
        cache: 'no-store',
        credentials: 'include'
      })
      if (!response.ok) return null
      const payload = await response.json().catch(() => null)
      const user = payload?.user
      if (!user?.id || !user?.uid) return null
      cachedIdentity = { authUid: String(user.uid), profileId: String(user.id) }
      return cachedIdentity
    } catch (error) {
      console.warn('Failed to load current identity:', error)
      return null
    } finally {
      inflightFetch = null
    }
  })()

  return inflightFetch
}

export function getCachedIdentity(): CurrentIdentity | null {
  return cachedIdentity
}

export async function getCurrentIdentity(): Promise<CurrentIdentity | null> {
  return loadIdentity()
}

export function setCurrentIdentity(identity: CurrentIdentity | null) {
  cachedIdentity = identity
}

export function clearCurrentIdentity() {
  cachedIdentity = null
  inflightFetch = null
}
