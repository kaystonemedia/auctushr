'use client'

import { initializeApp } from "firebase/app"
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as signOutUser,
  fetchSignInMethodsForEmail,
  updatePassword,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth"
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  Timestamp, 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc,
  serverTimestamp,
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager
} from "firebase/firestore"
import { EmployeeFormData } from '@/types/employee'
import { FirebaseApp } from 'firebase/app'

// Your Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
}

// Validate Firebase configuration
const missingConfigs = Object.entries(firebaseConfig)
  .filter(([_, value]) => !value)
  .map(([key]) => key)

if (missingConfigs.length > 0) {
  console.error('Missing Firebase configuration for:', missingConfigs.join(', '))
  throw new Error('Missing required Firebase configuration')
}

// Initialize Firebase
let app: FirebaseApp
try {
  app = initializeApp(firebaseConfig)
  console.log('Firebase initialized successfully')
} catch (error) {
  console.error('Error initializing Firebase:', error)
  throw error
}

export { app }
export const auth = getAuth(app)

// Initialize Firestore with persistent cache
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache(
    /*settings=*/{ tabManager: persistentSingleTabManager() }
  )
})

// Set persistence to LOCAL for auth
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.warn("Error setting auth persistence:", error)
  })
}

// Helper function to convert Firestore Timestamp to Date
export const convertTimestamp = (timestamp: Timestamp | { seconds: number } | null): Date => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate()
  }
  if (timestamp?.seconds) {
    return new Date(timestamp.seconds * 1000)
  }
  return new Date()
}

// Sign up function - creates user in both Auth and Firestore
export async function signUp(
  email: string,
  password: string,
  name: string,
  role: "admin" | "manager" | "employee" = "employee",
  managerId?: string | null
) {
  try {
    // Validate email format
    if (!email || !email.includes('@') || !email.includes('.')) {
      throw new Error('Invalid email format')
    }

    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    const user = userCredential.user

    console.log("User created in Auth:", user.uid)

    // Create base user data
    const userData = {
      uid: user.uid,
      email: user.email,
      firstName: name.split(' ')[0],
      lastName: name.split(' ').slice(1).join(' '),
      role,
      department: "", // Default empty values
      managerId: managerId || null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      hasPassword: true,
      status: "active",
      position: "",
      address: null,
      emergencyContact: null,
      documents: [],
      permissions: [],
      settings: {},
      metadata: {}
    }

    // Create the user document in Firestore
    try {
      if (role === "admin") {
        // Admin users only go in the users collection
        await setDoc(doc(db, "users", user.uid), {
          ...userData,
          isAdmin: true
        })
        console.log("Admin document created in users collection")
      } else {
        // Non-admin users go in the employees collection
        const employeeData = {
          ...userData,
          hireDate: Timestamp.fromDate(new Date()),
          salary: 0,
          managerId: managerId || null,
          isManager: role === "manager",
          managedEmployees: role === "manager" ? [] : undefined
        }

        await setDoc(doc(db, "employees", user.uid), employeeData)
        console.log(`${role} document created in employees collection`)
      }
    } catch (dbError) {
      console.error("Error creating user document in Firestore:", dbError)
      throw new Error("Failed to create user profile in database")
    }

    return user
  } catch (error) {
    console.error("Sign up error:", error)
    throw error
  }
}

// Check if user exists and has password set
export async function checkUserExists(emailOrUid: string) {
  try {
    // If the input looks like a UID (no @ symbol), try to find by UID first
    if (!emailOrUid.includes('@')) {
      // First check users collection
      const userDoc = await getDoc(doc(db, 'users', emailOrUid))
      if (userDoc.exists()) {
        const userData = userDoc.data()
        return {
          id: userDoc.id,
          hasPassword: userData.hasPassword || false,
          firstLogin: userData.firstLogin || false,
          role: userData.role,
          uid: userData.uid
        }
      }

      // Then check employees collection
      const employeeDoc = await getDoc(doc(db, 'employees', emailOrUid))
      if (employeeDoc.exists()) {
        const userData = employeeDoc.data()
        return {
          id: employeeDoc.id,
          hasPassword: userData.hasPassword || false,
          firstLogin: userData.firstLogin || false,
          role: userData.role,
          uid: userData.uid
        }
      }
    }

    // If not found by UID or if input is an email, search by email
    const usersRef = collection(db, 'users')
    const usersQuery = query(usersRef, where('email', '==', emailOrUid))
    const usersSnapshot = await getDocs(usersQuery)
    
    const employeesRef = collection(db, 'employees')
    const employeesQuery = query(employeesRef, where('email', '==', emailOrUid))
    const employeesSnapshot = await getDocs(employeesQuery)
    
    // If user exists in either collection by email
    if (!usersSnapshot.empty || !employeesSnapshot.empty) {
      const userDoc = usersSnapshot.docs[0] || employeesSnapshot.docs[0]
      const userData = userDoc.data()
      
      // If user has already set up their password, return that info
      if (userData.hasPassword) {
        return {
          id: userDoc.id,
          hasPassword: true,
          firstLogin: false,
          role: userData.role,
          uid: userData.uid
        }
      }
      
      // Otherwise, return the current state
      return {
        id: userDoc.id,
        hasPassword: userData.hasPassword || false,
        firstLogin: userData.firstLogin || false,
        role: userData.role,
        uid: userData.uid
      }
    }
    
    return null
  } catch (error) {
    console.error('Error checking user:', error)
    throw error
  }
}

// Sign in function
export async function signIn(email: string, password: string, isPasswordSetup: boolean = false) {
  try {
    // First authenticate with Firebase Auth
    let userCredential;
    try {
      userCredential = await signInWithEmailAndPassword(auth, email, password)
    } catch (error: any) {
      // If this is a first-time login attempt, we might need to create the auth user
      if (error.code === 'auth/user-not-found') {
        // Check if user exists in Firestore
        const userExists = await checkUserExists(email)
        if (!userExists) {
          throw new Error("No account found with this email. Please contact your administrator.")
        }

        // If user exists in Firestore but not in Auth, create the auth user
        if (!userExists.hasPassword && isPasswordSetup) {
          userCredential = await createUserWithEmailAndPassword(auth, email, password)
          
          // Update the user's document in Firestore
          const collectionName = userExists.role === "admin" ? "users" : "employees"
          await updateDoc(doc(db, collectionName, userExists.id), {
            uid: userCredential.user.uid,
            hasPassword: true,
            firstLogin: false,
            updatedAt: serverTimestamp()
          })
        } else {
          throw new Error("FIRST_TIME_LOGIN")
        }
      } else if (error.code === 'auth/invalid-credential') {
        throw new Error("Invalid email or password")
      } else {
        throw error
      }
    }

    const user = userCredential.user

    // Now that we're authenticated, get the user's data from Firestore
    const userDoc = await getDoc(doc(db, 'users', user.uid))
    const employeeDoc = await getDoc(doc(db, 'employees', user.uid))
    
    const userData = userDoc.exists() ? userDoc.data() : employeeDoc.exists() ? employeeDoc.data() : null
    
    if (!userData) {
      // If no user data found, sign out and throw error
      await signOut(auth)
      throw new Error("User account not found in database. Please contact support.")
    }

    // Update last login timestamp
    const collectionName = userData.role === "admin" ? "users" : "employees"
    await updateDoc(doc(db, collectionName, user.uid), {
      lastLogin: serverTimestamp()
    })

    return user
  } catch (error) {
    console.error("Sign in error:", error)
    throw error
  }
}

// Sign out function
export async function signOut() {
  try {
    await signOutUser(auth)
  } catch (error) {
    console.error("Sign out error:", error)
    throw error
  }
}

// Function to create required indexes
export async function createRequiredIndexes() {
  try {
    const indexes = [
      {
        collectionGroup: 'attendance',
        queryScope: 'COLLECTION',
        fields: [
          { fieldPath: 'employeeId', order: 'ASCENDING' },
          { fieldPath: 'date', order: 'DESCENDING' },
          { fieldPath: '__name__', order: 'DESCENDING' }
        ]
      }
    ]

    // Note: This is a placeholder. You'll need to use the Firebase Admin SDK
    // or the Firebase Console to actually create the indexes
    console.log('Required indexes:', indexes)
    
    // For now, you can use the Firebase Console link from the error message:
    // https://console.firebase.google.com/v1/r/project/kaystonemedia-c0f7c/firestore/indexes?create_composite=ClZwcm9qZWN0cy9rYXlzdG9uZW1lZGlhLWMwZjdjL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9hdHRlbmRhbmNlL2luZGV4ZXMvXxABGg4KCmVtcGxveWVlSWQQARoICgRkYXRlEAEaDAoIX19uYW1lX18QAQ
  } catch (error) {
    console.error('Error creating indexes:', error)
  }
}

export async function createEmployee(data: EmployeeFormData) {
  try {
    // Create a new document reference with auto-generated ID
    const employeeRef = doc(collection(db, 'employees'))
    const employeeId = employeeRef.id

    // Create the user in Firebase Auth first
    let authUser = null
    try {
      // Create a temporary password for initial setup
      const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8)
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, tempPassword)
      authUser = userCredential.user
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        // If email already exists, try to sign in to get the user
        try {
          const userCredential = await signInWithEmailAndPassword(auth, data.email, 'temporary_password')
          authUser = userCredential.user
        } catch (signInError: any) {
          if (signInError.code === 'auth/invalid-credential') {
            // If sign in fails, the user exists but with a different password
            // We'll need to handle this case differently
            console.error('User exists with different password')
            throw new Error('User already exists with a different password')
          }
          throw signInError
        }
      } else {
        throw error
      }
    }

    // Create base user data
    const userData = {
      uid: authUser?.uid || employeeId,
      ...data,
      hireDate: data.hireDate instanceof Date ? data.hireDate : new Date(data.hireDate),
      salary: Number(data.salary),
      status: data.status || 'active',
      hasPassword: false, // Will be set to true after first login
      firstLogin: true, // Indicates this is a first-time login
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }

    // Create the employee document
    await setDoc(employeeRef, userData)

    // Create a corresponding user document
    await setDoc(doc(db, 'users', authUser?.uid || employeeId), {
      ...userData,
      role: data.role || 'employee'
    })

    return {
      uid: authUser?.uid || employeeId,
      ...userData
    }
  } catch (error) {
    console.error('Error creating employee:', error)
    throw error
  }
}

// Export signOutUser
export { signOutUser }

// Create test user function
export async function createTestUser() {
  try {
    const email = 'test@example.com'
    const password = 'testpassword123'
    const name = 'Test User'
    
    // Check if user already exists
    const userExists = await checkUserExists(email)
    if (userExists) {
      return userExists
    }

    // Create new test user
    const user = await signUp(email, password, name, 'employee')
    return user
  } catch (error) {
    console.error('Error creating test user:', error)
    throw error
  }
}

