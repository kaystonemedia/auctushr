import { adminAuth } from '@/lib/firebase-admin'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json()

    // Create session cookie
    const expiresIn = 60 * 60 * 24 * 5 * 1000 // 5 days
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn })

    // Set cookie using response.cookies.set()
    const response = NextResponse.json({ status: 'success' })
    response.cookies.set('session', sessionCookie, {
      maxAge: expiresIn,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/'
    });

    return response
  } catch (error) {
    console.error('Error creating session:', error)
    return NextResponse.json(
      { error: 'Unauthorized request' },
      { status: 401 }
    )
  }
} 