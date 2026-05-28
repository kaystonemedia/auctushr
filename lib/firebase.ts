'use client'

import {
  getAuth,
  signInWithEmailAndPassword,
  signOut as signOutUser
} from '@/lib/data/auth'
import { getFirestore, Timestamp } from '@/lib/data/firestore'
import { EmployeeFormData } from '@/types/employee'

export const app = { provider: 'supabase-compat' }
export const auth = getAuth()
export const db = getFirestore()

export const convertTimestamp = (timestamp: Timestamp | { seconds: number } | null): Date => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate()
  }
  if (timestamp?.seconds) {
    return new Date(timestamp.seconds * 1000)
  }
  return new Date()
}

export async function signUp(
  email: string,
  password: string,
  name: string,
  role: 'admin' | 'manager' | 'employee' = 'employee'
) {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name, role })
  })
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to sign up')
  }

  const userCredential = await signInWithEmailAndPassword(auth, email, password)
  return userCredential.user
}

export async function checkUserExists(emailOrUid: string) {
  if (!emailOrUid.includes('@')) {
    return null
  }
  const response = await fetch(`/api/auth/preflight?email=${encodeURIComponent(emailOrUid)}`, {
    cache: 'no-store'
  })
  const payload = await response.json()
  if (!response.ok || !payload.exists) {
    return null
  }
  return {
    id: payload.id || null,
    hasPassword: Boolean(payload.hasPassword),
    role: payload.role || 'employee',
    uid: payload.uid || null,
    email: emailOrUid,
    requiresPasswordChange: Boolean(payload.requiresPasswordChange)
  }
}

export async function signIn(email: string, password: string, isPasswordSetup: boolean = false) {
  if (isPasswordSetup) {
    const setupResponse = await fetch('/api/auth/first-time-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const setupPayload = await setupResponse.json()
    if (!setupResponse.ok) {
      throw new Error(setupPayload.error || 'Failed to set password')
    }
  }

  const credential = await signInWithEmailAndPassword(auth, email, password)
  return credential.user
}

export async function signOut() {
  await signOutUser(auth)
}

export async function createRequiredIndexes() {
  return
}

export async function createEmployee(data: EmployeeFormData) {
  const token = await auth.currentUser?.getIdToken()
  const response = await fetch('/api/employees', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(data)
  })
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to create employee')
  }
  return payload.employee
}

export async function updateEmployee(id: string, data: EmployeeFormData) {
  const token = await auth.currentUser?.getIdToken()
  const response = await fetch('/api/employees', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ id, ...data })
  })
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to update employee')
  }
  return payload.employee
}

export async function deleteEmployee(id: string) {
  const token = await auth.currentUser?.getIdToken()
  const response = await fetch(`/api/employees?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  })
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to delete employee')
  }
}

export async function createAdmin(data: {
  email: string
  firstName: string
  lastName: string
  department: string
  position: string
  phone?: string
  emergencyContact?: {
    name: string
    relationship: string
    phone: string
  }
}) {
  return createEmployee({
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: data.phone || '',
    department: data.department,
    position: data.position,
    role: 'admin',
    managerId: null,
    hasPassword: false,
    hireDate: new Date(),
    salary: 0,
    status: 'active',
    mobileNumber: '',
    bankAccount: {
      accountNumber: '',
      bankCode: '',
      accountName: ''
    },
    address: {
      street: '',
      city: '',
      state: '',
      country: '',
      postalCode: ''
    },
    emergencyContact: data.emergencyContact || {
      name: '',
      relationship: '',
      phone: ''
    },
    documents: []
  })
}

export async function createManager(data: {
  email: string
  firstName: string
  lastName: string
  department: string
  position: string
  phone: string
  emergencyContact?: {
    name: string
    relationship: string
    phone: string
  }
}) {
  return createEmployee({
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: data.phone,
    department: data.department,
    position: data.position,
    role: 'manager',
    managerId: null,
    hasPassword: false,
    hireDate: new Date(),
    salary: 0,
    status: 'active',
    mobileNumber: '',
    bankAccount: {
      accountNumber: '',
      bankCode: '',
      accountName: ''
    },
    address: {
      street: '',
      city: '',
      state: '',
      country: '',
      postalCode: ''
    },
    emergencyContact: data.emergencyContact || {
      name: '',
      relationship: '',
      phone: ''
    },
    documents: []
  })
}

export async function createManagerAccount(
  email: string,
  firstName: string,
  lastName: string,
  department: string,
  position: string,
  phone: string,
  emergencyContact: {
    name: string
    relationship: string
    phone: string
  }
) {
  const manager = await createManager({
    email,
    firstName,
    lastName,
    department,
    position,
    phone,
    emergencyContact
  })
  return {
    user: manager,
    temporaryPassword: null,
    managerData: manager
  }
}

export async function createTestUser() {
  const email = 'test@example.com'
  const password = 'testpassword123'
  const name = 'Test User'
  return signUp(email, password, name, 'employee')
}

export { signOutUser }
