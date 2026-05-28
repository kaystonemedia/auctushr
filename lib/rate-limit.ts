/**
 * Simple in-memory rate limiter
 * For production, consider Redis-based rate limiting for distributed systems
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store (clears on server restart)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Cleanup old entries periodically (only in Node.js runtime, not Edge)
if (typeof window === 'undefined' && typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        rateLimitStore.delete(key)
      }
    }
  }, 60000) // Clean every minute
}

export interface RateLimitOptions {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
  identifier?: string // Custom identifier (defaults to IP)
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
}

/**
 * Check rate limit for a given identifier
 */
export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = {
    windowMs: 60000, // 1 minute
    maxRequests: 60, // 60 requests per minute
  }
): RateLimitResult {
  const now = Date.now()
  const key = identifier
  const entry = rateLimitStore.get(key)

  // If no entry or reset time passed, create new entry
  if (!entry || now > entry.resetTime) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + options.windowMs,
    }
    rateLimitStore.set(key, newEntry)
    return {
      allowed: true,
      remaining: options.maxRequests - 1,
      resetTime: newEntry.resetTime,
    }
  }

  // Check if limit exceeded
  if (entry.count >= options.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    }
  }

  // Increment count
  entry.count++
  rateLimitStore.set(key, entry)

  return {
    allowed: true,
    remaining: options.maxRequests - entry.count,
    resetTime: entry.resetTime,
  }
}

/**
 * Get client IP from request
 */
export function getClientIP(request: Request | { headers: Headers }): string {
  // Try various headers (for proxies/load balancers)
  const headers = 'headers' in request ? request.headers : request as Headers
  const forwardedFor = headers.get('x-forwarded-for')
  const realIP = headers.get('x-real-ip')
  const cfConnectingIP = headers.get('cf-connecting-ip')

  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim()
  }

  if (realIP) {
    return realIP
  }

  if (cfConnectingIP) {
    return cfConnectingIP
  }

  // Fallback to a default identifier
  return 'unknown'
}

/**
 * Rate limit middleware helper for API routes
 */
export function rateLimit(
  options: RateLimitOptions = {
    windowMs: 60000, // 1 minute
    maxRequests: 60, // 60 requests per minute
  }
) {
  return async (request: Request): Promise<Response | null> => {
    const identifier = options.identifier || getClientIP(request)
    const result = checkRateLimit(identifier, options)

    if (!result.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          resetTime: new Date(result.resetTime).toISOString(),
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': options.maxRequests.toString(),
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': result.resetTime.toString(),
            'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
          },
        }
      )
    }

    return null // null means rate limit passed
  }
}

