import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { rateLimit } from '@/lib/rate-limit'

// Add paths that don't require authentication
const publicPaths = [
  "/auth/sign-in",
  "/auth/sign-up",
  "/api/auth",
  "/_next",
  "/favicon.ico",
  "/images",
  "/assets",
  "/unauthorized",
  "/test-auth",
  "/test-scoring",
  "/api/test",
  "/api/webhook",
  "/api/health",
  "/api/status"
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname === '/test-chunk' || pathname.startsWith('/test-chunk/')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Rate limit API routes (especially public ones)
  if (pathname.startsWith('/api/')) {
    // Stricter rate limits for public API endpoints
    if (pathname.startsWith('/api/auth/') || pathname.startsWith('/api/webhook/')) {
      const rateLimitResponse = await rateLimit({
        windowMs: 60000, // 1 minute
        maxRequests: 20, // 20 requests per minute for auth/webhooks
      })(request)
      if (rateLimitResponse) {
        return rateLimitResponse
      }
    } else {
      // Standard rate limit for other API routes
      const rateLimitResponse = await rateLimit({
        windowMs: 60000, // 1 minute
        maxRequests: 60, // 60 requests per minute
      })(request)
      if (rateLimitResponse) {
        return rateLimitResponse
      }
    }
  }

  // Allow access to public paths
  if (publicPaths.some(path => pathname.startsWith(path))) {
    // If user has a session cookie and tries to access auth pages, redirect to dashboard
    const token = request.cookies.get('sb-access-token')?.value
    if (token && pathname.startsWith('/auth/')) {
      // Instead of verifying the token here, we'll let the client handle it
      // The client will redirect to dashboard if the token is valid
      return NextResponse.next()
    }
    return NextResponse.next()
  }

  // API routes should never be redirected to the sign-in page. Allow them to
  // pass through so route handlers can return JSON 401/403 responses via the
  // `requireRole`/`authenticateRequest` helpers.
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Check for session cookie
  const token = request.cookies.get('sb-access-token')?.value

  // If no session cookie, redirect to sign-in
  if (!token) {
    console.log('No session cookie found, redirecting to sign-in')
    const signInUrl = new URL('/auth/sign-in', request.url)
    signInUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(signInUrl)
  }

  // Let the client handle role-based access
  // The client will redirect to unauthorized if needed
  return NextResponse.next()
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths including API routes
     * Exclude static files and images
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}


