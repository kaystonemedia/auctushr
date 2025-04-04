// Firebase Types
export interface FirebaseUser {
  uid: string;
  email: string;
  role: 'admin' | 'manager' | 'employee';
  firstName: string;
  lastName: string;
  department: string;
  managerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FirebaseAttendance {
  id: string;
  userId: string;
  date: Date;
  checkIn: {
    time: Date;
    location: {
      latitude: number;
      longitude: number;
    };
    deviceInfo: string;
  };
  checkOut?: {
    time: Date;
    location: {
      latitude: number;
      longitude: number;
    };
    deviceInfo: string;
  };
  status: 'present' | 'absent' | 'late' | 'early_leave';
  notes?: string;
}

export interface FirebaseActivityLog {
  id: string;
  userId: string;
  timestamp: Date;
  activityType: 'browser' | 'application' | 'idle';
  details: {
    url?: string;
    applicationName?: string;
    duration: number;
    productivity: number;
  };
}

export interface FirebaseLeaveRequest {
  id: string;
  userId: string;
  type: 'annual' | 'sick' | 'unpaid' | 'other';
  startDate: Date;
  endDate: Date;
  status: 'pending' | 'approved' | 'rejected';
  reason: string;
  approvedBy?: string;
  approvedAt?: Date;
}

// MongoDB Types
export interface MongoEmployee {
  _id: string;  // Same as Firebase users.uid
  personalInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: {
      street: string;
      city: string;
      country: string;
      postalCode: string;
    };
    emergencyContact: {
      name: string;
      relationship: string;
      phone: string;
    };
  };
  employmentInfo: {
    department: string;
    position: string;
    managerId: string;
    startDate: Date;
    status: 'active' | 'inactive';
    salary: {
      base: number;
      currency: string;
      paymentSchedule: 'monthly' | 'biweekly';
    };
  };
  documents: Array<{
    type: string;
    url: string;
    uploadedAt: Date;
    expiryDate?: Date;
  }>;
}

export interface MongoPayroll {
  _id: string;
  employeeId: string;
  month: Date;
  year: number;
  earnings: {
    baseSalary: number;
    overtime: number;
    bonuses: number;
    allowances: number;
  };
  deductions: {
    tax: number;
    insurance: number;
    pension: number;
    other: number;
  };
  netPay: number;
  status: 'pending' | 'processed' | 'paid';
  paymentDate?: Date;
  payslipUrl?: string;
}

export interface MongoPerformanceReview {
  _id: string;
  employeeId: string;
  reviewPeriod: {
    start: Date;
    end: Date;
  };
  reviewerId: string;
  ratings: {
    technical: number;
    communication: number;
    teamwork: number;
    leadership: number;
    attendance: number;
  };
  feedback: string;
  goals: Array<{
    description: string;
    status: 'pending' | 'in_progress' | 'completed';
    dueDate: Date;
  }>;
  status: 'draft' | 'submitted' | 'approved';
}

export interface MongoAttendanceHistory {
  _id: string;
  employeeId: string;
  date: Date;
  checkIn: Date;
  checkOut: Date;
  status: string;
  location: {
    checkIn: {
      latitude: number;
      longitude: number;
    };
    checkOut: {
      latitude: number;
      longitude: number;
    };
  };
  deviceInfo: {
    checkIn: string;
    checkOut: string;
  };
} 