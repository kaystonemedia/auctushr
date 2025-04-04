import { NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { sessionCookie } = await request.json()

    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'No session cookie provided' },
        { status: 401 }
      )
    }

    const decodedClaims = await getAdminAuth().verifySessionCookie(sessionCookie)
    return NextResponse.json({ user: decodedClaims })
  } catch (error) {
    console.error('Error verifying session:', error)
    return NextResponse.json(
      { error: 'Invalid session' },
      { status: 401 }
    )
  }
} 