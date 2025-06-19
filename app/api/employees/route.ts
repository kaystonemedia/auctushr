import { NextResponse } from "next/server"
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin"
import { QueryDocumentSnapshot, DocumentData } from 'firebase-admin/firestore'

export async function GET(request: Request) {
  try {
    console.log('Fetching employees...')
    
    const token = request.headers.get('Authorization')?.split('Bearer ')[1]
    if (!token) {
      console.error('No authorization token provided')
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log('Verifying token...')
    const decodedToken = await getAdminAuth().verifyIdToken(token)
    console.log('Token verified for user:', decodedToken.uid)

    // Get user data from users, employees, and managers collections
    const userDoc = await getAdminDb().collection('users').doc(decodedToken.uid).get()
    const employeeDoc = await getAdminDb().collection('employees').doc(decodedToken.uid).get()
    let managerDoc = null;
    if (!userDoc.exists && !employeeDoc.exists) {
      // Try managers collection
      managerDoc = await getAdminDb().collection('managers').where('uid', '==', decodedToken.uid).limit(1).get();
      if (managerDoc.empty) {
        console.error('User document not found in users, employees, or managers:', decodedToken.uid)
        return NextResponse.json({ error: "User not found" }, { status: 404 })
      }
    }

    let userData = userDoc.exists ? userDoc.data() : (employeeDoc.exists ? employeeDoc.data() : null);
    if (!userData && managerDoc && !managerDoc.empty) {
      userData = managerDoc.docs[0].data();
    }
    console.log('User role:', userData?.role)

    if (userData?.role !== 'admin' && userData?.role !== 'manager') {
      console.error('User not authorized:', decodedToken.uid)
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Fetch all employees from the employees collection
    console.log('Fetching employees collection...')
    const employeesSnapshot = await getAdminDb().collection('employees').get()
    console.log(`Found ${employeesSnapshot.size} employees`)

    const employees = employeesSnapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => {
      const data = doc.data()
      console.log('Processing employee:', doc.id)
      
      // Convert Firestore Timestamps to Dates
      const employee = {
        id: doc.id,
        ...data,
        hireDate: data.hireDate?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        // Ensure all required fields are present
        status: data.status || 'active',
        hasPassword: data.hasPassword || false,
        role: data.role || 'employee',
        department: data.department || '',
        position: data.position || '',
        salary: data.salary || 0,
        managerId: data.managerId || null,
        documents: data.documents || [],
        address: data.address || null,
        emergencyContact: data.emergencyContact || null
      }
      
      console.log('Processed employee:', employee.id, data.email || 'No email')
      return employee
    })

    console.log('Returning employees data')
    return NextResponse.json({ employees })
  } catch (error) {
    console.error('Error in GET /api/employees:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
} 