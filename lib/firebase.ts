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
  onAuthStateChanged
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
  persistentSingleTabManager,
  deleteDoc
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
    // Check if this is a first-time setup attempt
    const isFirstUserAttempt = role === "admin";
    
    if (isFirstUserAttempt) {
      // For first admin user setup
      console.log("Attempting first admin user setup");
      
      // Check if any users exist
      const usersRef = collection(db, "users");
      const usersSnapshot = await getDocs(usersRef);
      
      if (!usersSnapshot.empty) {
        throw new Error("Direct sign-up is not allowed. Please contact your administrator to create your account.");
      }
      
      // Continue with first user setup...
    } else {
      // For all other attempts, prevent direct sign-up
      throw new Error("Direct sign-up is not allowed. Please contact your administrator to create your account.");
    }

    // Validate email format
    if (!email || !email.includes('@') || !email.includes('.')) {
      throw new Error('Invalid email format')
    }

    console.log("Starting first admin user setup for:", email)

    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    const user = userCredential.user

    console.log("First admin user created in Auth:", {
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified
    })

    // Wait for auth state and token to be ready
    await new Promise((resolve, reject) => {
      let attempts = 0
      const maxAttempts = 5
      const checkInterval = 1000 // 1 second

      const checkAuthState = async () => {
        const currentUser = auth.currentUser
        if (currentUser && currentUser.uid === user.uid) {
          try {
            // Force token refresh to ensure it's available
            const token = await currentUser.getIdToken(true)
            console.log("Auth state ready with token:", {
              uid: currentUser.uid,
              email: currentUser.email,
              tokenAvailable: !!token
            })
            resolve(true)
          } catch (tokenError) {
            console.error("Error getting token:", tokenError)
            if (attempts >= maxAttempts) {
              reject(new Error("Failed to get auth token"))
            } else {
              attempts++
              setTimeout(checkAuthState, checkInterval)
            }
          }
        } else {
          if (attempts >= maxAttempts) {
            reject(new Error("Auth state not ready after maximum attempts"))
          } else {
            attempts++
            setTimeout(checkAuthState, checkInterval)
          }
        }
      }

      // Start checking auth state
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        if (currentUser && currentUser.uid === user.uid) {
          checkAuthState()
        }
      })

      // Set a timeout to prevent infinite waiting
      setTimeout(() => {
        unsubscribe()
        if (attempts < maxAttempts) {
          reject(new Error("Auth state timeout"))
        }
      }, maxAttempts * checkInterval)
    })

    // Create base user data for first admin
    const userData = {
      uid: user.uid,
      email: user.email,
      firstName: name.split(' ')[0],
      lastName: name.split(' ').slice(1).join(' '),
      role: "admin",
      department: "Management",
      position: "Administrator",
      managerId: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      hasPassword: true,
      status: "active",
      address: null,
      emergencyContact: null,
      documents: [],
      permissions: ["admin"],
      settings: {},
      metadata: {
        isFirstUser: true
      }
    }

    console.log("Creating first admin document in users collection")

    // Create the first admin user document
    try {
      await setDoc(doc(db, "users", user.uid), {
        ...userData,
        isAdmin: true
      })
      console.log("First admin document created successfully")
    } catch (dbError: any) {
      console.error("Error creating first admin document:", {
        error: dbError,
        code: dbError.code,
        message: dbError.message,
        details: dbError.details
      })
      
      // If we fail to create the document, delete the auth account
      try {
        await user.delete()
        console.log("Auth account deleted after Firestore failure")
      } catch (deleteError) {
        console.error("Error deleting auth account:", deleteError)
      }
      
      throw new Error(`Failed to create first admin profile: ${dbError.message}`)
    }

    return user
  } catch (error: any) {
    console.error("Sign up error:", {
      error,
      code: error.code,
      message: error.message,
      details: error.details
    })
    throw error
  }
}

// Check if user exists and has password set
export async function checkUserExists(emailOrUid: string) {
  try {
    console.log('Checking user exists for:', emailOrUid);
    
    // If the input looks like a UID (no @ symbol), try to find by UID first
    if (!emailOrUid.includes('@')) {
      console.log('Checking by UID...');
      // First check users collection
      const userDoc = await getDoc(doc(db, 'users', emailOrUid))
      if (userDoc.exists()) {
        console.log('Found in users collection');
        const userData = userDoc.data()
        return {
          id: userDoc.id,
          hasPassword: userData.hasPassword || false,
          role: userData.role,
          uid: userData.uid,
          email: userData.email
        }
      }

      // Then check employees collection
      const employeeDoc = await getDoc(doc(db, 'employees', emailOrUid))
      if (employeeDoc.exists()) {
        console.log('Found in employees collection');
        const userData = employeeDoc.data()
        return {
          id: employeeDoc.id,
          hasPassword: userData.hasPassword || false,
          role: userData.role,
          uid: userData.uid,
          email: userData.email
        }
      }
    }

    console.log('Checking by email...');
    // If not found by UID or if input is an email, search by email
    // First check employees collection with just email
    const employeesRef = collection(db, 'employees')
    const employeesQuery = query(
      employeesRef, 
      where('email', '==', emailOrUid)
    )
    console.log('Executing employees query...');
    const employeesSnapshot = await getDocs(employeesQuery)
    console.log('Query results:', employeesSnapshot.empty ? 'No results' : 'Found results');
    
    if (!employeesSnapshot.empty) {
      const employeeDoc = employeesSnapshot.docs[0]
      const userData = employeeDoc.data()
      console.log('Found employee:', userData);
      return {
        id: employeeDoc.id,
        hasPassword: userData.hasPassword || false,
        role: userData.role,
        uid: userData.uid,
        email: userData.email
      }
    }

    // If not found in employees, check users collection
    console.log('Checking users collection...');
    const usersRef = collection(db, 'users')
    const usersQuery = query(usersRef, where('email', '==', emailOrUid))
    const usersSnapshot = await getDocs(usersQuery)
    
    if (!usersSnapshot.empty) {
      const userDoc = usersSnapshot.docs[0]
      const userData = userDoc.data()
      console.log('Found user:', userData);
      return {
        id: userDoc.id,
        hasPassword: userData.hasPassword || false,
        role: userData.role,
        uid: userData.uid,
        email: userData.email
      }
    }
    
    console.log('No user found');
    return null
  } catch (error) {
    console.error('Error checking user:', error)
    throw error
  }
}

// Sign in function with first-time login handling
export async function signIn(email: string, password: string, isPasswordSetup: boolean = false) {
  try {
    // First attempt Firebase Auth sign in
    let userCredential;
    try {
      userCredential = await signInWithEmailAndPassword(auth, email, password);
    } catch (authError: any) {
      if (authError.code === 'auth/user-not-found') {
        // If user not found in Auth, check if they exist in Firestore for first-time login
        const userExists = await checkUserExists(email);
        if (!userExists) {
          throw new Error("No account found with this email. Please contact your administrator.");
        }
        if (!userExists.hasPassword && isPasswordSetup) {
          // Handle first-time login setup
          return handleFirstTimeLogin(email, password, userExists);
        }
        throw new Error("FIRST_TIME_LOGIN");
      }
      if (authError.code === 'auth/wrong-password') {
        throw new Error("Invalid email or password");
      }
      throw authError;
    }

    const user = userCredential.user;

    // Now that we're authenticated, check Firestore for user data
    const userExists = await checkUserExists(email);
    if (!userExists) {
      // If no Firestore document found, sign out and throw error
      await signOutUser(auth);
      throw new Error("User profile not found");
    }

    // Verify the user's UID matches the document
    if (userExists.uid && userExists.uid !== user.uid) {
      await signOutUser(auth);
      throw new Error("Account mismatch. Please contact your administrator.");
    }

    // Update last login timestamp
    const collectionName = userExists.role === "admin" ? "users" : "employees";
    await updateDoc(doc(db, collectionName, userExists.id), {
      lastLogin: serverTimestamp()
    });

    return user;
  } catch (error: any) {
    if (error.code === 'auth/invalid-credential') {
      throw new Error("Invalid email or password");
    }
    throw error;
  }
}

// Helper function to handle first-time login setup
async function handleFirstTimeLogin(email: string, password: string, userExists: any) {
  try {
    // Create new auth account
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Wait for auth state to be ready
    await new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 5;
      const checkInterval = 1000; // 1 second

      const checkAuthState = async () => {
        const currentUser = auth.currentUser;
        if (currentUser && currentUser.uid === user.uid) {
          try {
            await currentUser.getIdToken(true);
            resolve(true);
          } catch (tokenError) {
            if (attempts >= maxAttempts) {
              reject(new Error("Failed to get auth token"));
            } else {
              attempts++;
              setTimeout(checkAuthState, checkInterval);
            }
          }
        } else {
          if (attempts >= maxAttempts) {
            reject(new Error("Auth state not ready after maximum attempts"));
          } else {
            attempts++;
            setTimeout(checkAuthState, checkInterval);
          }
        }
      };

      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        if (currentUser && currentUser.uid === user.uid) {
          checkAuthState();
        }
      });

      setTimeout(() => {
        unsubscribe();
        if (attempts < maxAttempts) {
          reject(new Error("Auth state timeout"));
        }
      }, maxAttempts * checkInterval);
    });

    // Update Firestore document
    const collectionName = userExists.role === "admin" ? "users" : "employees";
    const docRef = doc(db, collectionName, userExists.id);
    
    // Verify document still exists and hasn't been modified
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      await user.delete();
      throw new Error("User document no longer exists");
    }
    
    const currentData = docSnap.data();
    if (currentData.hasPassword) {
      await user.delete();
      throw new Error("Password has already been set for this account");
    }

    // Update document
    await updateDoc(docRef, {
      uid: user.uid,
      hasPassword: true,
      updatedAt: serverTimestamp()
    });

    return user;
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      // Try to sign in instead
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update Firestore document
      const collectionName = userExists.role === "admin" ? "users" : "employees";
      await updateDoc(doc(db, collectionName, userExists.id), {
        uid: user.uid,
        hasPassword: true,
        updatedAt: serverTimestamp()
      });

      return user;
    }
    throw error;
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

// Create employee function updated for delayed auth
export async function createEmployee(data: EmployeeFormData) {
  try {
    // Create a new document reference with auto-generated ID
    const employeeRef = doc(collection(db, 'employees'))
    const employeeId = employeeRef.id

    // Create base user data without Firebase Auth user
    const userData = {
      id: employeeId,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      department: data.department,
      position: data.position,
      role: data.role || 'employee',
      managerId: data.managerId || null,
      hireDate: data.hireDate instanceof Date ? data.hireDate : new Date(data.hireDate),
      salary: Number(data.salary),
      status: data.status || 'active',
      hasPassword: false, // Will be set to true after first login
      uid: null, // Will be set after first login
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      address: data.address || null,
      emergencyContact: data.emergencyContact || null,
      documents: data.documents || []
    }

    // Create the employee document
    await setDoc(employeeRef, userData)

    return {
      id: employeeId,
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

export async function updateEmployee(id: string, data: EmployeeFormData) {
  // Update the employee document in Firestore
  await updateDoc(doc(db, 'employees', id), {
    ...data,
    updatedAt: new Date()
  })
}

export async function deleteEmployee(id: string) {
  // Delete the employee document from Firestore
  await deleteDoc(doc(db, 'employees', id))
}

