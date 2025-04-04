export interface Employee {
  id: string;
  uid?: string | null;
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