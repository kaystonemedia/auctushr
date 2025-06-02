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
  deleteDoc,
  limit
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
      
      // Use queries with limit(1) for all collections to match security rules
      const collections = ['users', 'managers', 'employees'];
      
      for (const collectionName of collections) {
        try {
          const collectionRef = collection(db, collectionName);
          const uidQuery = query(
            collectionRef,
            where('uid', '==', emailOrUid),
            limit(1)
          );
          
          const snapshot = await getDocs(uidQuery);
          if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            const userData = doc.data();
            console.log(`Found in ${collectionName} collection`);
            return {
              id: doc.id,
              hasPassword: userData.hasPassword || false,
              role: userData.role,
              uid: userData.uid,
              email: userData.email,
              requiresPasswordChange: userData.requiresPasswordChange || false
            };
          }
        } catch (error) {
          console.log(`Error querying ${collectionName} by UID:`, error);
          continue; // Try next collection
        }
      }
    }

    console.log('Checking by email...');
    // If not found by UID or if input is an email, search by email
    const collections = ['managers', 'employees', 'users'];
    
    for (const collectionName of collections) {
      try {
        console.log(`Attempting to query ${collectionName} collection...`);
        const collectionRef = collection(db, collectionName);
        
        // Directly try the email query
        const emailQuery = query(
          collectionRef,
          where('email', '==', emailOrUid)
        );
        
        console.log(`Executing ${collectionName} query...`);
        const snapshot = await getDocs(emailQuery);
        console.log(`Query results for ${collectionName}:`, snapshot.empty ? 'No results' : 'Found results');
        
        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          const userData = doc.data();
          console.log(`Found in ${collectionName}:`, userData);
          return {
            id: doc.id,
            hasPassword: userData.hasPassword || false,
            role: userData.role,
            uid: userData.uid,
            email: userData.email,
            requiresPasswordChange: userData.requiresPasswordChange || false
          };
        }
      } catch (error) {
        console.log(`Error querying ${collectionName} by email:`, error);
        continue; // Try next collection
      }
    }
    
    console.log('No user found');
    return null;
  } catch (error) {
    console.error('Error checking user:', error);
    throw error;
  }
}

// Helper function to handle first-time login setup
async function handleFirstTimeLogin(email: string, password: string, userExists: any) {
  try {
    // First, update the Firestore document to mark it as in-progress
    const collectionName = userExists.role === "admin" ? "users" : 
                          userExists.role === "manager" ? "managers" : "employees";
    const collectionRef = collection(db, collectionName);
    const docQuery = query(
      collectionRef,
      where('email', '==', email),
      limit(1)
    );
    
    const snapshot = await getDocs(docQuery);
    if (snapshot.empty) {
      throw new Error("User document no longer exists");
    }
    
    const docRef = doc(db, collectionName, snapshot.docs[0].id);
    const currentData = snapshot.docs[0].data();
    
    if (currentData.hasPassword) {
      throw new Error("Password has already been set for this account");
    }

    // Create new auth account
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Immediately update Firestore with the new UID
    await updateDoc(docRef, {
      uid: user.uid,
      hasPassword: true,
      updatedAt: serverTimestamp()
    });

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

    return user;
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      // Try to sign in instead
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update Firestore document using a query
      const collectionName = userExists.role === "admin" ? "users" : 
                            userExists.role === "manager" ? "managers" : "employees";
      const collectionRef = collection(db, collectionName);
      const docQuery = query(
        collectionRef,
        where('email', '==', email),
        limit(1)
      );
      
      const snapshot = await getDocs(docQuery);
      if (!snapshot.empty) {
        const docRef = doc(db, collectionName, snapshot.docs[0].id);
        await updateDoc(docRef, {
          uid: user.uid,
          hasPassword: true,
          updatedAt: serverTimestamp()
        });
      }

      return user;
    }
    throw error;
  }
}

// Sign in function with first-time login handling
export async function signIn(email: string, password: string, isPasswordSetup: boolean = false) {
  try {
    // First check if user exists in Firestore for first-time login
    const userExists = await checkUserExists(email);
    console.log('User exists check result:', userExists);

    if (!userExists) {
      throw new Error("No account found with this email. Please contact your administrator.");
    }

    // For first-time login setup, use handleFirstTimeLogin directly
    if (!userExists.hasPassword && isPasswordSetup) {
      console.log('Handling first-time login setup');
      return handleFirstTimeLogin(email, password, userExists);
    }

    // For regular login, check if password is set
    if (!userExists.hasPassword && !isPasswordSetup) {
      console.log('First time login detected, redirecting to password setup');
      throw new Error("FIRST_TIME_LOGIN");
    }

    // Then attempt Firebase Auth sign in
    let userCredential;
    try {
      userCredential = await signInWithEmailAndPassword(auth, email, password);
    } catch (authError: any) {
      console.log('Auth error:', authError.code);
      
      if (authError.code === 'auth/wrong-password') {
        throw new Error("Invalid email or password");
      }
      throw authError;
    }

    const user = userCredential.user;

    // Verify the user's UID matches the document
    if (userExists.uid && userExists.uid !== user.uid) {
      await signOutUser(auth);
      throw new Error("Account mismatch. Please contact your administrator.");
    }

    // Check if password change is required
    if (userExists.requiresPasswordChange && !isPasswordSetup) {
      await signOutUser(auth);
      throw new Error("PASSWORD_CHANGE_REQUIRED");
    }

    // Update last login timestamp
    const collectionName = userExists.role === "admin" ? "users" : 
                          userExists.role === "manager" ? "managers" : "employees";
    await updateDoc(doc(db, collectionName, userExists.id), {
      lastLogin: serverTimestamp(),
      // If this was a password setup, update the hasPassword flag
      ...(isPasswordSetup && { 
        hasPassword: true,
        requiresPasswordChange: false 
      })
    });

    return user;
  } catch (error: any) {
    console.error('Sign in error:', error);
    if (error.code === 'auth/invalid-credential') {
      throw new Error("Invalid email or password");
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

// Generate a random temporary password
function generateTemporaryPassword() {
  const length = 12;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  return password;
}

// Create manager account with temporary password
export async function createManagerAccount(
  email: string,
  firstName: string,
  lastName: string,
  department: string,
  position: string,
  phone: string,
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  }
) {
  // Store the current admin user
  const adminUser = auth.currentUser;
  if (!adminUser) {
    throw new Error("Admin session not found. Please sign in again.");
  }

  try {
    // Check if email already exists
    const methods = await fetchSignInMethodsForEmail(auth, email);
    if (methods.length > 0) {
      throw new Error("Email already in use");
    }

    // Generate temporary password
    const temporaryPassword = generateTemporaryPassword();

    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, temporaryPassword);
    const user = userCredential.user;

    // Create manager document in Firestore
    const managerData = {
      uid: user.uid,
      email: email,
      firstName,
      lastName,
      role: "manager",
      department,
      position,
      phone,
      emergencyContact,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      hasPassword: true, // Set to true since we created with temp password
      status: "active",
      requiresPasswordChange: true, // Flag to require password change on first login
      permissions: ["manager"],
      settings: {},
      metadata: {
        isFirstLogin: true,
        createdBy: adminUser.uid // Use the stored admin user's UID
      }
    };

    // Create document in users collection
    await setDoc(doc(db, "users", user.uid), managerData);

    // Sign out the manager account and sign back in as admin
    await signOutUser(auth);
    await signInWithEmailAndPassword(auth, adminUser.email!, adminUser.email!);

    return {
      user,
      temporaryPassword,
      managerData
    };
  } catch (error: any) {
    console.error("Error creating manager account:", error);
    
    // If we created the auth user but failed to create the document, delete the auth account
    if (error.code === "auth/email-already-in-use") {
      throw new Error("Email already in use");
    }

    // If we created the auth user but failed to create the document, clean up
    if (error.code === "auth/email-already-in-use" || error.message?.includes("permissions")) {
      try {
        // Try to sign back in as admin
        if (adminUser.email) {
          await signInWithEmailAndPassword(auth, adminUser.email, adminUser.email);
        }
      } catch (signInError) {
        console.error("Error signing back in as admin:", signInError);
      }
    }
    
    throw error;
  }
}

// Create manager function with delayed auth
export async function createManager(data: {
  email: string;
  firstName: string;
  lastName: string;
  department: string;
  position: string;
  phone: string;
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
}) {
  try {
    // Create a new document reference with auto-generated ID
    const managerRef = doc(collection(db, 'managers'))
    const managerId = managerRef.id

    // Create base manager data without Firebase Auth user
    const managerData = {
      id: managerId,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      department: data.department,
      position: data.position,
      role: 'manager',
      status: 'active',
      hasPassword: false, // Will be set to true after first login
      uid: null, // Will be set after first login
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      emergencyContact: data.emergencyContact,
      permissions: ['manager'],
      settings: {},
      metadata: {
        isFirstLogin: true,
        createdBy: auth.currentUser?.uid
      }
    }

    // Create the manager document
    await setDoc(managerRef, managerData)

    return {
      id: managerId,
      ...managerData
    }
  } catch (error) {
    console.error('Error creating manager:', error)
    throw error
  }
}

