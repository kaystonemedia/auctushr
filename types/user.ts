export type UserRole = 'admin' | 'manager' | 'employee'

export interface User {
  id: string
  uid: string
  email: string
  name: string
  role: UserRole
  department?: string
  managerId?: string | null
  photoURL?: string | null
  createdAt?: Date
  updatedAt?: Date
}

export interface UserPermissions {
  canManageEmployees: boolean
  canViewPayroll: boolean
  canProcessPayroll: boolean
  canViewAnalytics: boolean
  canManageDocuments: boolean
  canManageSettings: boolean
  canViewAttendance: boolean
  canManageAttendance: boolean
  canViewPerformance: boolean
  canManagePerformance: boolean
}

export const ROLE_PERMISSIONS: Record<UserRole, UserPermissions> = {
  admin: {
    canManageEmployees: true,
    canViewPayroll: true,
    canProcessPayroll: true,
    canViewAnalytics: true,
    canManageDocuments: true,
    canManageSettings: true,
    canViewAttendance: true,
    canManageAttendance: true,
    canViewPerformance: true,
    canManagePerformance: true,
  },
  manager: {
    canManageEmployees: false,
    canViewPayroll: true,
    canProcessPayroll: false,
    canViewAnalytics: true,
    canManageDocuments: false,
    canManageSettings: false,
    canViewAttendance: true,
    canManageAttendance: true,
    canViewPerformance: true,
    canManagePerformance: true,
  },
  employee: {
    canManageEmployees: false,
    canViewPayroll: true,
    canProcessPayroll: false,
    canViewAnalytics: false,
    canManageDocuments: false,
    canManageSettings: false,
    canViewAttendance: true,
    canManageAttendance: false,
    canViewPerformance: true,
    canManagePerformance: false,
  },
} 