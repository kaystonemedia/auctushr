import { NextRequest, NextResponse } from 'next/server'
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore'

type PersonDoc = {
  id: string
  collection: 'users' | 'managers' | 'employees'
  [key: string]: any
}

export async function GET(request: NextRequest) {
  try {
    // Ensure this is server-side only
    if (typeof window !== 'undefined') {
      throw new Error('This API route must be called server-side only')
    }
    
    // Dynamically import Firebase Admin (Admin SDK)
    const { adminDb } = await import('@/lib/firebase-admin')
    
    // Check if Firebase Admin is properly initialized
    if (!adminDb) {
      throw new Error('Firebase Admin SDK not properly initialized.')
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')

    const results: {
      hasFirebaseAdmin: boolean
      totalUsers: number
      totalManagers: number
      totalEmployees: number
      totalPayrollEntries: number
      employeeDetails: any
      employeePayrollEntries: Array<{ id: string; data: any }>
      allPeople: PersonDoc[]
      error?: string
    } = {
      hasFirebaseAdmin: !!adminDb,
      totalUsers: 0,
      totalManagers: 0,
      totalEmployees: 0,
      totalPayrollEntries: 0,
      employeeDetails: null,
      employeePayrollEntries: [],
      allPeople: []
    }

    try {
      // Check if adminDb is properly initialized
      if (!adminDb) {
        throw new Error('Firebase Admin DB is null or undefined')
      }

      console.log('Testing Firebase Admin DB connection...')
      console.log('adminDb type:', typeof adminDb)
      console.log('adminDb keys:', Object.keys(adminDb))
      
      // Test if we can access the collection method
      if (typeof adminDb.collection !== 'function') {
        throw new Error(`Firebase Admin DB collection method not available. adminDb type: ${typeof adminDb}, available methods: ${Object.keys(adminDb).join(', ')}`)
      }
      
      // Count total users (admins and some managers)
      const usersSnapshot = await adminDb.collection('users').limit(10).get()
      results.totalUsers = usersSnapshot.size
      
      // Count total managers
      const managersSnapshot = await adminDb.collection('managers').limit(10).get()
      results.totalManagers = managersSnapshot.size
      
      // Count total employees
      const employeesSnapshot = await adminDb.collection('employees').limit(10).get()
      results.totalEmployees = employeesSnapshot.size
      
      // Count total payroll entries
      const payrollSnapshot = await adminDb.collection('payrollEntries').limit(10).get()
      results.totalPayrollEntries = payrollSnapshot.size

      // Get sample data from all collections
      const allPeople = [
        ...usersSnapshot.docs.map((doc: QueryDocumentSnapshot) => ({ 
          id: doc.id, 
          collection: 'users',
          ...doc.data() 
        })),
        ...managersSnapshot.docs.map((doc: QueryDocumentSnapshot) => ({ 
          id: doc.id, 
          collection: 'managers',
          ...doc.data() 
        })),
        ...employeesSnapshot.docs.map((doc: QueryDocumentSnapshot) => ({ 
          id: doc.id, 
          collection: 'employees',
          ...doc.data() 
        }))
      ]
      results.allPeople = allPeople.slice(0, 5) // Show first 5 people

      // If employeeId is provided, get specific details from all collections
      if (employeeId) {
        try {
          // Check all collections for this employee
          const [userDoc, managerDoc, employeeDoc] = await Promise.all([
            adminDb.collection('users').doc(employeeId).get(),
            adminDb.collection('managers').doc(employeeId).get(),
            adminDb.collection('employees').doc(employeeId).get()
          ])
          
          if (userDoc.exists()) {
            results.employeeDetails = {
              id: employeeId,
              exists: true,
              collection: 'users',
              data: userDoc.data()
            }
          } else if (managerDoc.exists()) {
            results.employeeDetails = {
              id: employeeId,
              exists: true,
              collection: 'managers',
              data: managerDoc.data()
            }
          } else if (employeeDoc.exists()) {
            results.employeeDetails = {
              id: employeeId,
              exists: true,
              collection: 'employees',
              data: employeeDoc.data()
            }
          } else {
            results.employeeDetails = {
              id: employeeId,
              exists: false,
              error: 'Employee not found in any collection (users, managers, employees)'
            }
          }
        } catch (error) {
          results.employeeDetails = {
            id: employeeId,
            exists: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }

        // Get payroll entries for this employee
        try {
          const employeePayrollQuery = adminDb
            .collection('payrollEntries')
            .where('employeeId', '==', employeeId)
            .limit(5)
          const employeePayrollSnapshot = await employeePayrollQuery.get()
          results.employeePayrollEntries = employeePayrollSnapshot.docs.map((doc: QueryDocumentSnapshot) => ({
            id: doc.id,
            data: doc.data()
          }))
        } catch (error) {
          results.employeePayrollEntries = []
        }
      }

    } catch (error) {
      results.error = error instanceof Error ? error.message : 'Unknown error'
    }

    return NextResponse.json({
      success: true,
      ...results
    })

  } catch (error) {
    console.error('Error in diagnose endpoint:', error)
    return NextResponse.json(
      { 
        error: 'Diagnose failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 