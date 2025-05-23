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
    '/help'
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
    '/help'
  ]
}

// Define default routes for each role
const defaultRoutes = {
  admin: '/dashboard',
  manager: '/dashboard',
  employee: '/dashboard'
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow access to public paths regardless of authentication status
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // Check for auth token
  const authToken = request.cookies.get('auth-token')
  const userRole = request.cookies.get('user-role')?.value as 'admin' | 'manager' | 'employee' | undefined

  // If user is not authenticated and trying to access protected routes
  if (!authToken) {
    // If trying to access root path, redirect to sign-in
    if (pathname === "/") {
      const signInUrl = new URL("/auth/sign-in", request.url)
      return NextResponse.redirect(signInUrl)
    }
    // For all other protected routes, redirect to sign-in
    const signInUrl = new URL("/auth/sign-in", request.url)
    signInUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(signInUrl)
  }

  // If user is authenticated but no role cookie is set, let the client handle the role check
  if (!userRole) {
    return NextResponse.next()
  }

  // If user is authenticated and trying to access auth pages, redirect to their role's dashboard
  if (pathname.startsWith("/auth/")) {
    return NextResponse.redirect(new URL(defaultRoutes[userRole], request.url))
  }

  // Check if user is trying to access root path
  if (pathname === "/") {
    return NextResponse.redirect(new URL(defaultRoutes[userRole], request.url))
  }

  // Check role-based access
  const allowedRoutes = roleBasedRoutes[userRole] || []
  const hasAccess = allowedRoutes.some(route => pathname.startsWith(route))

  if (!hasAccess) {
    // If user doesn't have access to the route, redirect to unauthorized page
    return NextResponse.redirect(new URL("/unauthorized", request.url))
  }

  // Allow access to the requested route
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


