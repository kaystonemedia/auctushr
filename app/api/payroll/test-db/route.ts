import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('=== Testing Firebase Admin DB ===')
    
    // Test 1: Import Firebase Admin
    console.log('1. Importing Firebase Admin...')
    const { adminDb } = await import('@/lib/firebase-admin')
    console.log('adminDb imported:', !!adminDb)
    console.log('adminDb type:', typeof adminDb)
    
    if (!adminDb) {
      return NextResponse.json({
        success: false,
        error: 'adminDb is null or undefined'
      })
    }
    
    // Test 2: Check adminDb properties
    console.log('2. Checking adminDb properties...')
    console.log('adminDb keys:', Object.keys(adminDb))
    console.log('Has collection method:', typeof adminDb.collection === 'function')
    
    // Test 3/4/5/6 using Admin SDK query API
    console.log('3. Testing Admin SDK query...')
    try {
      const testCollection = adminDb.collection('test')
      console.log('Collection reference created:', !!testCollection)
      
      console.log('5. Testing query...')
      const testSnapshot = await testCollection.limit(1).get()
      console.log('Query executed successfully, size:', testSnapshot.size)
      
      return NextResponse.json({
        success: true,
        message: 'Firebase Admin DB is working correctly',
        tests: {
          adminDbImported: true,
          adminDbType: typeof adminDb,
          hasCollectionMethod: typeof adminDb.collection === 'function',
          firestoreFunctionsImported: true,
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
          hasCollectionMethod: typeof adminDb.collection === 'function',
          firestoreFunctionsImported: true,
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