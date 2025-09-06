import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('=== Testing Firebase Admin Connection ===')
    
    // Test Firebase Admin initialization
    let adminDb = null
    let firebaseAdmin = null
    let status: {
      adminInitialized: boolean
      dbConnected: boolean
      collections: string[]
      error: string | null
      sampleDocument?: any
    } = {
      adminInitialized: false,
      dbConnected: false,
      collections: [],
      error: null
    }
    
    try {
      const firebaseAdminModule = await import('@/lib/firebase-admin')
      adminDb = firebaseAdminModule.adminDb
      
      if (!adminDb) {
        throw new Error('Firebase Admin DB not initialized')
      }
      
      status.adminInitialized = true
      status.dbConnected = true
      
      // Test database access by listing documents in 'users' collection
      try {
        const collectionsSnapshot = await (adminDb as any).collection('users').limit(1).get()
        status.collections.push('users')
        
        // Try to get a sample document
        if (!collectionsSnapshot.empty) {
          const sampleDoc = collectionsSnapshot.docs[0]
          status.sampleDocument = {
            id: sampleDoc.id,
            exists: sampleDoc.exists(),
            data: sampleDoc.data()
          }
        }
        
      } catch (dbError) {
        console.error('Database access error:', dbError)
        status.error = dbError instanceof Error ? dbError.message : 'Unknown database error'
      }
      
    } catch (importError) {
      console.error('Firebase Admin import error:', importError)
      status.error = importError instanceof Error ? importError.message : 'Unknown import error'
    }
    
    return NextResponse.json({
      success: status.adminInitialized && status.dbConnected,
      status,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Error in Firebase test:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Firebase test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 