import { NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebase-admin'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // TODO: Replace with actual Firebase Auth sign in
    // This is a mock implementation for testing
    if (email === 'new@example.com') {
      return NextResponse.json(
        { error: 'FIRST_TIME_LOGIN' },
        { status: 401 }
      )
    }

    if (email === 'nonexistent@example.com') {
      return NextResponse.json(
        { error: 'No account found with this email. Please contact your administrator.' },
        { status: 401 }
      )
    }

    if (password !== 'password') {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      )
    }

    // Mock successful login
    const mockUser = {
      uid: '1',
      email,
      role: 'employee',
      name: 'Test User'
    }

    // Create a mock session cookie
    const sessionCookie = 'mock-session-cookie'
    
    // Set the session cookie
    const response = NextResponse.json({ 
      user: {
        id: mockUser.uid,
        email: mockUser.email,
        role: mockUser.role,
        name: mockUser.name
      }
    })

    response.cookies.set('session', sessionCookie, {
      maxAge: 60 * 60 * 24 * 7, // 7 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Failed to sign in' },
      { status: 500 }
    )
  }
} 