import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'

export async function GET(request: NextRequest) {
  try {
    const adminDb = getAdminDb()
    // Simple sanity test using Admin SDK's query API
    const snapshot = await adminDb.collection('test').limit(1).get()
    return NextResponse.json({
      success: true,
      message: 'Firebase Admin SDK test successful',
      snapshotSize: snapshot.size
    })
  } catch (error) {
    console.error('Error in admin v2 test:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}