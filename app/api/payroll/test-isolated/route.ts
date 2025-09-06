import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('=== Testing Isolated Firebase Admin ===')
    
    // Test 1: Import Firebase Admin directly
    console.log('1. Importing Firebase Admin directly...')
    
    // Import individual modules
    const { initializeApp, getApps, cert } = await import('firebase-admin/app')
    const { getFirestore } = await import('firebase-admin/firestore')
    
    console.log('2. Checking environment variables...')
    const projectId = process.env.FIREBASE_PROJECT_ID
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
    
    if (!projectId || !clientEmail || !privateKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing environment variables',
        envVars: {
          projectId: !!projectId,
          clientEmail: !!clientEmail,
          privateKey: !!privateKey
        }
      })
    }
    
    console.log('3. Initializing Firebase Admin...')
    let app
    if (!getApps().length) {
      app = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      })
      console.log('Firebase Admin app initialized')
    } else {
      app = getApps()[0]
      console.log('Firebase Admin app already exists')
    }
    
    console.log('4. Getting Firestore instance...')
    const db = getFirestore(app)
    console.log('Firestore instance created:', !!db)
    console.log('DB type:', typeof db)
    console.log('DB keys:', Object.keys(db as any))
    
    try {
      const testSnapshot = await (db as any).collection('test').limit(1).get()
      console.log('8. Query executed successfully, size:', testSnapshot.size)
      
      return NextResponse.json({
        success: true,
        message: 'Isolated Firebase Admin test successful',
        tests: {
          firebaseAdminImported: true,
          appInitialized: true,
          firestoreCreated: true,
          dbType: typeof db,
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
          firebaseAdminImported: true,
          appInitialized: true,
          firestoreCreated: true,
          dbType: typeof db,
          collectionReferenceCreated: false,
          queryCreated: false,
          queryExecuted: false
        }
      })
    }
    
  } catch (error) {
    console.error('Error in isolated test:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Isolated test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 