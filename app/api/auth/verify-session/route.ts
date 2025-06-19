import { NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebase-admin'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('session')?.value

    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'No session cookie' },
        { status: 401 }
      )
    }

    // Verify the session cookie
    const decodedClaims = await getAdminAuth().verifySessionCookie(sessionCookie)
    
    // Set the user role cookie
    const response = NextResponse.json({ 
      user: {
        id: decodedClaims.uid,
        email: decodedClaims.email,
        role: decodedClaims.role || 'employee'
      }
    })

    // Set the user role cookie
    response.cookies.set('user-role', decodedClaims.role || 'employee', {
      maxAge: 60 * 60 * 24 * 7, // 7 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    })

    return response
  } catch (error) {
    console.error('Error verifying session:', error)
    
    // Clear the session cookie if it's invalid
    const response = NextResponse.json(
      { error: 'Invalid session' },
      { status: 401 }
    )
    response.cookies.set('session', '', { expires: new Date(0), path: '/' })
    response.cookies.set('user-role', '', { expires: new Date(0), path: '/' })
    
    return response
  }
} 