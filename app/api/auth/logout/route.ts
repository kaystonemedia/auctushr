import { NextResponse } from 'next/server'

export async function POST() {
  try {
    // Clear the session cookie by setting it to expire in the past
    const response = NextResponse.json({ status: 'success' })
    response.cookies.set('session', '', { expires: new Date(0), path: '/' })
    return response
  } catch (error) {
    console.error('Error clearing session:', error)
    return NextResponse.json(
      { error: 'Failed to clear session' },
      { status: 500 }
    )
  }
} 