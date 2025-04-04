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
  enableIndexedDbPersistence, 
  Timestamp, 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc,
  serverTimestamp 
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
}

// Validate Firebase configuration
Object.entries(firebaseConfig).forEach(([key, value]) => {
  if (!value) {
    console.warn(`Missing Firebase configuration for ${key}`)
  }
})

// Initialize Firebase
let app: FirebaseApp
try {
  app = initializeApp(firebaseConfig)
} catch (error) {
  console.error('Error initializing Firebase:', error)
  throw error
}

export { app }
export const auth = getAuth(app)
export const db = getFirestore(app)

// Enable offline persistence for Firestore - must be called before any other Firestore operations
if (typeof window !== 'undefined') { // Only enable persistence on the client side
  try {
    enableIndexedDbPersistence(db).catch((err) => {
      if (err.code === "failed-precondition") {
        console.warn("Multiple tabs open, persistence can only be enabled in one tab at a time.")
      } else if (err.code === "unimplemented") {
        console.warn("The current browser doesn't support persistence")
      } else {
        console.warn("Persistence setup failed:", err)
      }
    })
  } catch (error) {
    console.warn("Error enabling persistence:", error)
  }

  // Set persistence to LOCAL
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
    // First check if user exists in Firestore
    const userExists = await checkUserExists(email)
    if (!userExists) {
      throw new Error("No user found")
    }

    // If this is a first-time login and password setup is not being attempted
    if (userExists.firstLogin && !isPasswordSetup) {
      throw new Error("First time login - password setup required")
    }

    if (isPasswordSetup) {
      // Get the default password from environment variables
      const defaultPassword = process.env.NEXT_PUBLIC_DEFAULT_PASSWORD
      if (!defaultPassword) {
        throw new Error("Default password not configured")
      }

      try {
        // First try to sign in with the default password
        const userCredential = await signInWithEmailAndPassword(auth, email, defaultPassword)
        const user = userCredential.user

        // Update password
        await updatePassword(user, password)
        
        // Update the collection where the user exists
        const collectionName = userExists.role === "admin" ? "users" : "employees"
        await updateDoc(doc(db, collectionName, userExists.id), {
          hasPassword: true,
          firstLogin: false, // Mark as no longer first login
          updatedAt: serverTimestamp(),
          uid: user.uid
        })

        return user
      } catch (signInError: any) {
        console.error("Error signing in with default password:", signInError)
        if (signInError.code === 'auth/invalid-credential') {
          // If the default password is wrong, try to sign in with the new password
          try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password)
            const user = userCredential.user
            
            // Update the collection where the user exists
            const collectionName = userExists.role === "admin" ? "users" : "employees"
            await updateDoc(doc(db, collectionName, userExists.id), {
              hasPassword: true,
              firstLogin: false, // Mark as no longer first login
              updatedAt: serverTimestamp(),
              uid: user.uid
            })

            return user
          } catch (error) {
            console.error("Error signing in with new password:", error)
            throw new Error("Failed to sign in with new password")
          }
        }
        throw signInError
      }
    } else {
      // Normal sign in
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      // Update last login in Firestore
      const collectionName = userExists.role === "admin" ? "users" : "employees"
      await updateDoc(doc(db, collectionName, userExists.id), {
        lastLogin: serverTimestamp(),
        uid: user.uid
      })

      return user
    }
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

export async function createEmployee(employeeData: EmployeeFormData) {
  const maxRetries = 3;
  let retryCount = 0;
  let lastError;

  while (retryCount < maxRetries) {
    try {
      // Get default password from environment variables
      const defaultPassword = process.env.NEXT_PUBLIC_DEFAULT_PASSWORD
      if (!defaultPassword) {
        throw new Error("Default password not configured")
      }

      // Check if user already exists
      const existingUser = await checkUserExists(employeeData.email)
      if (existingUser) {
        throw new Error("User with this email already exists")
      }

      // Create user in Firebase Auth with a default password
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        employeeData.email,
        defaultPassword
      ).catch((error) => {
        if (error.code === 'auth/network-request-failed') {
          throw new Error('Network error. Please check your internet connection and try again.')
        }
        throw error
      })

      const user = userCredential.user

      // Create base user data
      const userData = {
        uid: user.uid,
        email: user.email,
        firstName: employeeData.firstName,
        lastName: employeeData.lastName,
        role: employeeData.role || "employee",
        department: employeeData.department || "",
        managerId: employeeData.managerId || null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        hasPassword: false,
        firstLogin: true,
        status: "active",
        position: employeeData.position || "",
        address: employeeData.address || null,
        emergencyContact: employeeData.emergencyContact || null,
        documents: [],
        permissions: [],
        settings: {},
        metadata: {}
      }

      // Create the user document in Firestore with the Auth user's UID as the document ID
      try {
        if (employeeData.role === "admin") {
          await setDoc(doc(db, "users", user.uid), {
            ...userData,
            isAdmin: true
          })
          console.log("Admin document created in users collection")
        } else {
          const employeeDoc = {
            ...userData,
            hireDate: Timestamp.fromDate(new Date()),
            salary: employeeData.salary || 0,
            isManager: employeeData.role === "manager",
            managerId: employeeData.managerId || null,
            managedEmployees: [] // Always initialize as an empty array instead of undefined
          }

          await setDoc(doc(db, "employees", user.uid), employeeDoc)
          console.log(`${employeeData.role} document created in employees collection`)

          await setDoc(doc(db, "users", user.uid), {
            ...userData,
            isAdmin: false
          })
          console.log("User reference created in users collection")
        }

        // Verify the document was created
        const collectionName = employeeData.role === "admin" ? "users" : "employees"
        const docRef = doc(db, collectionName, user.uid)
        const docSnap = await getDoc(docRef)
        
        if (!docSnap.exists()) {
          throw new Error(`Failed to create ${collectionName} document`)
        }

        console.log(`Successfully created and verified ${collectionName} document for user:`, user.uid)
        return user
      } catch (dbError) {
        console.error("Error creating user document in Firestore:", dbError)
        // If document creation fails, delete the Auth user
        await user.delete()
        throw new Error("Failed to create user profile in database")
      }
    } catch (error) {
      lastError = error
      console.error(`Attempt ${retryCount + 1} failed:`, error)
      
      if (error instanceof Error && error.message.includes('Network error')) {
        retryCount++
        if (retryCount < maxRetries) {
          // Wait for 1 second before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)))
          continue
        }
      }
      
      // If it's not a network error or we've exhausted retries, throw the error
      throw error
    }
  }

  // If we've exhausted all retries, throw the last error
  throw lastError
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

