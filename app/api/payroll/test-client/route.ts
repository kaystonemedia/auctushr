import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['admin'])
  if (auth.error) return auth.error

  try {
    console.log('=== Testing data adapter SDK ===')
    
    // Import adapter APIs
    const { initializeApp } = await import('@/lib/data/app')
    const { getFirestore, collection, getDocs, query, limit } = await import('@/lib/data/firestore')
    
    console.log('1. Data adapters imported successfully')
    
    // Initialize Firebase (this should use the existing config)
    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
    }
    
    console.log('2. Firebase config:', {
      hasApiKey: !!firebaseConfig.apiKey,
      hasProjectId: !!firebaseConfig.projectId,
      projectId: firebaseConfig.projectId
    })
    
    initializeApp(firebaseConfig)
    const db = getFirestore()
    
    console.log('3. Data adapter initialized')
    console.log('4. Collection function type:', typeof collection)
    
    try {
      const testCollection = collection(db, 'test')
      console.log('5. Collection reference created:', !!testCollection)
      
      const testQuery = query(testCollection, limit(1))
      console.log('6. Query created:', !!testQuery)
      
      const testSnapshot = await getDocs(testQuery)
      console.log('7. Query executed successfully, size:', testSnapshot.size)
      
      return NextResponse.json({
        success: true,
        message: 'Data adapter test successful',
        tests: {
          firebaseImported: true,
          appInitialized: true,
          firestoreCreated: true,
          collectionFunctionType: typeof collection,
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
          firebaseImported: true,
          appInitialized: true,
          firestoreCreated: true,
          collectionFunctionType: typeof collection,
          collectionReferenceCreated: false,
          queryCreated: false,
          queryExecuted: false
        }
      })
    }
    
  } catch (error) {
    console.error('Error in client test:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Client test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 