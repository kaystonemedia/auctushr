export interface Employee {
  id: string;
  uid?: string | null;
  employeeCode?: string; // Auto-generated (EMP-0001) — see profiles.employee_code
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  role: 'admin' | 'manager' | 'employee';
  managerId?: string | null;
  hasPassword: boolean;
  hireDate: Date;
  salary: number;
  status: 'active' | 'inactive' | 'on_leave';
  photoURL?: string | null;
  // Payment details for payroll
  mobileNumber?: string; // E.164 format (e.g., 233XXXXXXXXX for Ghana)
  ssnitNumber?: string; // Ghana social security number, shown on payslips
  bankAccount?: {
    accountNumber: string;
    bankCode: string;
    accountName: string;
    bankName?: string;
    branch?: string;
  };
  // Source collection this document lives in
  collection?: 'users' | 'employees' | 'managers';
  address?: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
  documents?: {
    id: string;
    name: string;
    type: string;
    url: string;
    uploadedAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

export type EmployeeFormData = Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>; 