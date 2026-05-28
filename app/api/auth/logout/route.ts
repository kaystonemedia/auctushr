import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const response = NextResponse.json({ status: 'success' })
    response.cookies.set('sb-access-token', '', { expires: new Date(0), path: '/' })
    response.cookies.set('sb-refresh-token', '', { expires: new Date(0), path: '/' })
    // Keep compatibility with legacy Firebase cookie during transition.
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