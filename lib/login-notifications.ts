import { db } from './firebase'
import { collection, query, where, getDocs, doc, getDoc } from '@/lib/data/firestore'
import { createNotification } from './notifications'

/**
 * Notify manager and active admins when an employee logs in
 */
export async function notifyLogin(employeeId: string, employeeName: string): Promise<void> {
  try {
    // Get employee data to find manager
    const employeeCollections = ['employees', 'users']
    let employeeData: any = null
    let managerId: string | null = null

    for (const collectionName of employeeCollections) {
      const employeeQuery = query(
        collection(db, collectionName),
        where('uid', '==', employeeId)
      )
      const employeeSnapshot = await getDocs(employeeQuery)
      
      if (!employeeSnapshot.empty) {
        employeeData = employeeSnapshot.docs[0].data()
        managerId = employeeData.managerId || null
        break
      }
    }

    // If not found by uid, try by document ID
    if (!employeeData) {
      for (const collectionName of employeeCollections) {
        try {
          const employeeDocRef = doc(db, collectionName, employeeId)
          const employeeDocSnap = await getDoc(employeeDocRef)
          if (employeeDocSnap.exists()) {
            employeeData = employeeDocSnap.data()
            managerId = employeeData.managerId || null
            break
          }
        } catch (error) {
          // Continue to next collection
        }
      }
    }

    // Notify manager if exists
    if (managerId) {
      // Find manager in managers, users, or employees collections
      const managerCollections = ['managers', 'users', 'employees']
      let managerFound = false

      for (const collectionName of managerCollections) {
        const managerQuery = query(
          collection(db, collectionName),
          where('uid', '==', managerId)
        )
        const managerSnapshot = await getDocs(managerQuery)
        
        if (!managerSnapshot.empty) {
          const managerData = managerSnapshot.docs[0].data()
          await createNotification({
            type: 'custom',
            message: `${employeeName} has logged in to the system`,
            severity: 'info',
            employeeId: managerId,
            data: {
              type: 'employee_login',
              employeeId,
              employeeName,
              timestamp: new Date()
            }
          })
          managerFound = true
          break
        }
      }

      // If not found by uid, try by document ID (direct doc reference)
      if (!managerFound) {
        for (const collectionName of managerCollections) {
          try {
            const managerDocRef = doc(db, collectionName, managerId)
            const managerDocSnap = await getDoc(managerDocRef)
            if (managerDocSnap.exists()) {
              await createNotification({
                type: 'custom',
                message: `${employeeName} has logged in to the system`,
                severity: 'info',
                employeeId: managerId,
                data: {
                  type: 'employee_login',
                  employeeId,
                  employeeName,
                  timestamp: new Date()
                }
              })
              break
            }
          } catch (error) {
            // Continue to next collection
          }
        }
      }
    }

    // Notify all active admins
    const adminsQuery = query(
      collection(db, 'users'),
      where('role', '==', 'admin'),
      where('status', '==', 'active')
    )
    const adminsSnapshot = await getDocs(adminsQuery)
    
    for (const adminDoc of adminsSnapshot.docs) {
      const adminData = adminDoc.data()
      const adminId = adminData.uid || adminDoc.id
      
      // Skip if this is the employee themselves
      if (adminId === employeeId) continue
      
      await createNotification({
        type: 'custom',
        message: `${employeeName} has logged in to the system`,
        severity: 'info',
        employeeId: adminId,
        data: {
          type: 'employee_login',
          employeeId,
          employeeName,
          timestamp: new Date()
        }
      })
    }
  } catch (error) {
    console.error('Error notifying login:', error)
  }
}

/**
 * Notify manager and active admins when an employee logs out
 */
export async function notifyLogout(employeeId: string, employeeName: string): Promise<void> {
  try {
    // Get employee data to find manager
    const employeeCollections = ['employees', 'users']
    let employeeData: any = null
    let managerId: string | null = null

    for (const collectionName of employeeCollections) {
      const employeeQuery = query(
        collection(db, collectionName),
        where('uid', '==', employeeId)
      )
      const employeeSnapshot = await getDocs(employeeQuery)
      
      if (!employeeSnapshot.empty) {
        employeeData = employeeSnapshot.docs[0].data()
        managerId = employeeData.managerId || null
        break
      }
    }

    // If not found by uid, try by document ID (direct doc reference)
    if (!employeeData) {
      for (const collectionName of employeeCollections) {
        try {
          // Try to get document directly by ID
          const employeeDocRef = doc(db, collectionName, employeeId)
          const employeeDocSnap = await getDoc(employeeDocRef)
          if (employeeDocSnap.exists()) {
            employeeData = employeeDocSnap.data()
            managerId = employeeData.managerId || null
            break
          }
        } catch (error) {
          // Continue to next collection
        }
      }
    }

    // Notify manager if exists
    if (managerId) {
      const managerCollections = ['managers', 'users', 'employees']
      let managerFound = false

      for (const collectionName of managerCollections) {
        const managerQuery = query(
          collection(db, collectionName),
          where('uid', '==', managerId)
        )
        const managerSnapshot = await getDocs(managerQuery)
        
        if (!managerSnapshot.empty) {
          await createNotification({
            type: 'custom',
            message: `${employeeName} has logged out of the system`,
            severity: 'info',
            employeeId: managerId,
            data: {
              type: 'employee_logout',
              employeeId,
              employeeName,
              timestamp: new Date()
            }
          })
          managerFound = true
          break
        }
      }

      if (!managerFound) {
        for (const collectionName of managerCollections) {
          try {
            // Try to get document directly by ID
            const managerDocRef = doc(db, collectionName, managerId)
            const managerDocSnap = await getDoc(managerDocRef)
            if (managerDocSnap.exists()) {
              await createNotification({
                type: 'custom',
                message: `${employeeName} has logged out of the system`,
                severity: 'info',
                employeeId: managerId,
                data: {
                  type: 'employee_logout',
                  employeeId,
                  employeeName,
                  timestamp: new Date()
                }
              })
              break
            }
          } catch (error) {
            // Continue
          }
        }
      }
    }

    // Notify all active admins
    const adminsQuery = query(
      collection(db, 'users'),
      where('role', '==', 'admin'),
      where('status', '==', 'active')
    )
    const adminsSnapshot = await getDocs(adminsQuery)
    
    for (const adminDoc of adminsSnapshot.docs) {
      const adminData = adminDoc.data()
      const adminId = adminData.uid || adminDoc.id
      
      if (adminId === employeeId) continue
      
      await createNotification({
        type: 'custom',
        message: `${employeeName} has logged out of the system`,
        severity: 'info',
        employeeId: adminId,
        data: {
          type: 'employee_logout',
          employeeId,
          employeeName,
          timestamp: new Date()
        }
      })
    }
  } catch (error) {
    console.error('Error notifying logout:', error)
  }
}

