import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
}

if (!supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable')
}

// =============================================================================
// Session token bridge
// -----------------------------------------------------------------------------
// The httpOnly cookie set by /api/auth/login cannot be read by client JS, so we
// expose it via /api/auth/token. To make `supabase.from(...)` calls go through
// PostgREST as the authenticated user (so RLS policies allow data access), we
// inject the Authorization header at fetch time. We deliberately only touch
// PostgREST + Storage requests so that /auth/v1 endpoints (sign-in, password
// reset, etc.) keep using their default headers.
// =============================================================================

const SESSION_TOKEN_TTL_MS = 4 * 60 * 1000

let cachedSessionToken: string | null = null
let cachedSessionTokenExpiresAt = 0
let inflightSessionTokenFetch: Promise<string | null> | null = null

async function fetchSessionTokenFromApi(): Promise<string | null> {
  if (typeof window === 'undefined') return null

  if (cachedSessionToken && Date.now() < cachedSessionTokenExpiresAt) {
    return cachedSessionToken
  }

  if (inflightSessionTokenFetch) {
    return inflightSessionTokenFetch
  }

  inflightSessionTokenFetch = (async () => {
    try {
      const response = await fetch('/api/auth/token', {
        cache: 'no-store',
        credentials: 'include'
      })
      if (!response.ok) {
        cachedSessionToken = null
        cachedSessionTokenExpiresAt = 0
        return null
      }
      const payload = await response.json().catch(() => null)
      const token = payload?.token
      if (typeof token === 'string' && token.length > 0) {
        cachedSessionToken = token
        cachedSessionTokenExpiresAt = Date.now() + SESSION_TOKEN_TTL_MS
        return token
      }
      cachedSessionToken = null
      cachedSessionTokenExpiresAt = 0
      return null
    } catch (error) {
      console.warn('Failed to fetch Supabase session token:', error)
      cachedSessionToken = null
      cachedSessionTokenExpiresAt = 0
      return null
    } finally {
      inflightSessionTokenFetch = null
    }
  })()

  return inflightSessionTokenFetch
}

export function resetSupabaseSessionTokenCache() {
  cachedSessionToken = null
  cachedSessionTokenExpiresAt = 0
  inflightSessionTokenFetch = null
}

export async function primeSupabaseSessionToken(): Promise<string | null> {
  return fetchSessionTokenFromApi()
}

function shouldAttachAuthHeader(url: string): boolean {
  if (!supabaseUrl) return false
  if (!url.startsWith(supabaseUrl)) return false
  return url.includes('/rest/v1/') || url.includes('/storage/v1/')
}

async function responseContainsExpiredJwt(response: Response): Promise<boolean> {
  if (response.status !== 401) return false
  try {
    const bodyText = await response.clone().text()
    return /jwt expired/i.test(bodyText)
  } catch {
    return false
  }
}

const authenticatedFetch: typeof fetch = async (input, init) => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
      ? input.toString()
      : input.url

  if (!shouldAttachAuthHeader(url)) {
    return fetch(input as RequestInfo, init)
  }

  const token = await fetchSessionTokenFromApi()
  if (!token) {
    return fetch(input as RequestInfo, init)
  }

  const buildHeadersWithToken = (value: string) => {
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined)
    )
    headers.set('Authorization', `Bearer ${value}`)
    return headers
  }

  const performRequest = (value: string) => {
    const headers = buildHeadersWithToken(value)
    if (input instanceof Request) {
      return fetch(new Request(input, { headers }), init)
    }
    return fetch(input as RequestInfo, { ...init, headers })
  }

  let response = await performRequest(token)
  if (!(await responseContainsExpiredJwt(response))) {
    return response
  }

  // Token may be expired while still cached. Force-refresh once and retry.
  resetSupabaseSessionTokenCache()
  const refreshedToken = await fetchSessionTokenFromApi()
  if (!refreshedToken) {
    return response
  }

  response = await performRequest(refreshedToken)
  return response
}

const globalSupabase = globalThis as typeof globalThis & {
  __supabaseClientSingleton?: ReturnType<typeof createClient>
}

export const supabaseClient =
  globalSupabase.__supabaseClientSingleton ??
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true
    },
    global: {
      fetch: authenticatedFetch
    }
  })

if (!globalSupabase.__supabaseClientSingleton) {
  globalSupabase.__supabaseClientSingleton = supabaseClient
}
