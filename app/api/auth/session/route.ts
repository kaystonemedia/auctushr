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

    // Set cookie (await cookies() before using it)
    const cookieStore = await cookies();
    cookieStore.set('session', sessionCookie, {
      maxAge: expiresIn,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/'
    });

    return NextResponse.json({ status: 'success' })
  } catch (error) {
    console.error('Error creating session:', error)
    return NextResponse.json(
      { error: 'Unauthorized request' },
      { status: 401 }
    )
  }
} 