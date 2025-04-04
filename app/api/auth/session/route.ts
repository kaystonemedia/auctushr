import { NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json()

    if (!idToken) {
      return NextResponse.json(
        { error: 'No ID token provided' },
        { status: 401 }
      )
    }

    const sessionCookie = await getAdminAuth().createSessionCookie(idToken)

    // Set the session cookie
    const response = NextResponse.json({ success: true })
    response.cookies.set('session', sessionCookie, {
      maxAge: 60 * 60 * 24 * 5, // 5 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Error creating session:', error)
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 401 }
    )
  }
} 