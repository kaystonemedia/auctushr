import { NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const token = request.headers.get('Authorization')?.split('Bearer ')[1]
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 })
    }

    const decodedToken = await getAdminAuth().verifyIdToken(token)
    const userDoc = await getAdminDb().collection('users').doc(decodedToken.uid).get()

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userData = userDoc.data()
    return NextResponse.json({ user: { ...userData, id: userDoc.id } })
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 