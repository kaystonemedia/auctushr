import { NextResponse } from "next/server"
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin"
import { QueryDocumentSnapshot, DocumentData } from 'firebase-admin/firestore'

export async function GET(request: Request) {
  try {
    const token = request.headers.get('Authorization')?.split('Bearer ')[1]
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const decodedToken = await getAdminAuth().verifyIdToken(token)
    const userDoc = await getAdminDb().collection('users').doc(decodedToken.uid).get()

    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const userData = userDoc.data()
    if (userData?.role !== 'admin' && userData?.role !== 'manager') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Fetch all employees
    const employeesSnapshot = await getAdminDb().collection('users').get()
    const employees = employeesSnapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
      id: doc.id,
      ...doc.data()
    }))

    return NextResponse.json({ employees })
  } catch (error) {
    console.error("Error fetching employees:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
} 