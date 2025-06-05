import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

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
  "/api/webhook",
  "/api/health",
  "/api/status"
]

// Define role-based route access
const roleBasedRoutes = {
  admin: [
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
    '/managers',
    '/administrators'
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
    '/help'
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
    '/attendance/reports'  // Allow employees to view their own reports
  ]
}

// Define default routes for each role
const defaultRoutes = {
  admin: '/dashboard',
  manager: '/dashboard',
  employee: '/dashboard'
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow access to public paths
  if (publicPaths.some(path => pathname.startsWith(path))) {
    // If user has a session cookie and tries to access auth pages, redirect to dashboard
    const token = request.cookies.get('session')?.value
    if (token && pathname.startsWith('/auth/')) {
      // Instead of verifying the token here, we'll let the client handle it
      // The client will redirect to dashboard if the token is valid
      return NextResponse.next()
    }
    return NextResponse.next()
  }

  // Check for session cookie
  const token = request.cookies.get('session')?.value

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
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
}


