import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

export async function GET(request: NextRequest) {
  try {
    console.log('=== Testing Firebase Admin DB with Static Imports ===')
    
    console.log('1. adminDb imported:', !!adminDb)
    console.log('2. adminDb type:', typeof adminDb)
    console.log('3. adminDb keys:', Object.keys(adminDb))
    console.log('4. Has collection method:', typeof (adminDb as any).collection === 'function')
    
    if (!adminDb) {
      return NextResponse.json({
        success: false,
        error: 'adminDb is null or undefined'
      })
    }
    
    try {
      const testCollection = (adminDb as any).collection('test')
      console.log('6. Collection reference created:', !!testCollection)
      
      const testSnapshot = await testCollection.limit(1).get()
      console.log('8. Query executed successfully, size:', testSnapshot.size)
      
      return NextResponse.json({
        success: true,
        message: 'Firebase Admin DB is working correctly with Admin SDK APIs',
        tests: {
          adminDbImported: true,
          adminDbType: typeof adminDb,
          hasCollectionMethod: typeof (adminDb as any).collection === 'function',
          collectionReferenceCreated: true,
          queryCreated: true,
          queryExecuted: true,
          snapshotSize: testSnapshot.size
        }
      })
      
    } catch (error) {
      console.error('Error in collection/query test:', error)
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        tests: {
          adminDbImported: true,
          adminDbType: typeof adminDb,
          hasCollectionMethod: typeof (adminDb as any).collection === 'function',
          collectionReferenceCreated: false,
          queryCreated: false,
          queryExecuted: false
        }
      })
    }
    
  } catch (error) {
    console.error('Error in DB test:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'DB test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 