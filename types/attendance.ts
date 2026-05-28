export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  managerId?: string;
  date: Date;
  checkIn: {
    time: Date;
    location?: {
      latitude: number;
      longitude: number;
      accuracy?: number;
      generalLocation?: string; // e.g., "Accra, Ghana" or "New York, United States"
      city?: string;
      country?: string;
      address?: string;
    };
    deviceInfo?: {
      browser: string;
      os: string;
      ip?: string;
    };
  };
  checkOut?: {
    time: Date;
    location?: {
      latitude: number;
      longitude: number;
      accuracy?: number;
      generalLocation?: string; // e.g., "Accra, Ghana" or "New York, United States"
      city?: string;
      country?: string;
      address?: string;
    };
    deviceInfo?: {
      browser: string;
      os: string;
      ip?: string;
    };
  };
  status: 'present' | 'absent' | 'late' | 'early_leave' | 'half_day';
  idleTime?: {
    startTime: Date;
    endTime: Date;
    duration: number; // in minutes
  }[];
  // Calculated fields for timesheet reporting
  totalHours?: number; // Total hours from clock in to clock out
  activeTime?: number; // Active time in minutes (total time - idle time)
  idleTimeTotal?: number; // Total idle time in minutes
  idleTimeSLAStatus?: 'normal' | 'warning' | 'exceeded'; // SLA status based on threshold
  flags?: {
    type: 'irregular_hours' | 'multiple_idle_periods' | 'location_mismatch' | 'device_change';
    description: string;
    severity: 'low' | 'medium' | 'high';
    timestamp: Date;
  }[];
  notes?: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvalNotes?: string;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  breaks?: BreakTime[];
  overtime?: OvertimeRecord;
  shift?: ShiftSchedule;
}

export interface AttendanceStats {
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  earlyLeaveDays: number;
  halfDays: number;
  attendanceRate: number;
  averageIdleTime: number; // in minutes
  flags: {
    count: number;
    byType: {
      irregular_hours: number;
      multiple_idle_periods: number;
      location_mismatch: number;
      device_change: number;
    };
  };
  approvalStats: {
    pending: number;
    approved: number;
    rejected: number;
  };
  averageHours: number;
  overtimeHours: number;
  pendingApprovals: number;
}

export interface AttendanceFilters {
  startDate?: Date;
  endDate?: Date;
  employeeId?: string;
  department?: string;
  status?: AttendanceRecord['status'];
  hasFlags?: boolean;
  approvalStatus?: AttendanceRecord['approvalStatus'];
  managerId?: string;
  search?: string;
}

export interface AttendanceSettings {
  workingHours: {
    start: string;
    end: string;
  };
  idleThreshold: number; // minutes
  idleTimeSLAThreshold: number; // minutes - threshold for SLA (default 2-3 minutes)
  maxIdlePeriods: number;
  allowedLateMinutes: number;
  locationRadius: number; // meters
  requiredCheckInDays: string[];
  requireManagerApproval: boolean;
  autoApproveThreshold: number; // minutes
}

export interface AttendanceNotification {
  id: string;
  type: 'late_check_in' | 'absent' | 'flag_raised' | 'approval_required' | 'approved' | 'rejected' | 'idle_time' | 'location_mismatch' | 'break' | 'meeting' | 'idle' | 'late' | 'early' | 'custom';
  employeeId: string;
  employeeName?: string;
  managerId?: string;
  attendanceId?: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'info' | 'warning' | 'error';
  read: boolean;
  createdAt: Date;
  updatedAt?: Date;
  data?: any;
}

export interface BreakTime {
  id: string;
  employeeId: string;
  date: Date;
  startTime: Date;
  endTime?: Date;
  type: 'lunch' | 'short_break' | 'meeting';
  duration?: number; // in minutes
  status: 'active' | 'completed';
  approved: boolean;
  notes?: string;
}

export interface OvertimeRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: Date;
  startTime: Date;
  endTime: Date;
  hours: number;
  reason: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: Date;
  notes?: string;
}

export interface ShiftSchedule {
  id: string;
  employeeId?: string;
  departmentId?: string;
  employeeName: string;
  shiftType: 'morning' | 'evening' | 'night' | 'custom';
  startTime: string;
  endTime: string;
  breakDuration: number; // in minutes
  workingDays: ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday')[];
  effectiveFrom: Date;
  effectiveTo?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AttendanceAnalytics {
  overview: {
    totalEmployees: number;
    presentToday: number;
    absentToday: number;
    lateToday: number;
    onLeaveToday: number;
    averageAttendanceRate: number;
  };
  trends: {
    daily: Array<{
      date: Date;
      present: number;
      absent: number;
      late: number;
      onLeave: number;
    }>;
    weekly: Array<{
      weekStart: Date;
      weekEnd: Date;
      averageAttendance: number;
      lateEntries: number;
      earlyLeavers: number;
    }>;
    monthly: Array<{
      month: Date;
      attendanceRate: number;
      overtimeHours: number;
      averageWorkHours: number;
    }>;
  };
  employeeStats: Array<{
    employeeId: string;
    name: string;
    totalDays: number;
    presentDays: number;
    lateDays: number;
    absentDays: number;
  }>;
  departmentWise: Array<{
    department: string;
    totalEmployees: number;
    attendanceRate: number;
    latePercentage: number;
    absentPercentage: number;
  }>;
  predictions: {
    nextWeek: {
      expectedAttendance: number;
      potentialAbsences: number;
      predictedLateArrivals: number;
    };
  };
}

// Timesheet summary for daily/weekly/bi-weekly reports
export interface TimesheetSummary {
  employeeId: string;
  employeeName: string;
  period: {
    start: Date;
    end: Date;
    type: 'daily' | 'weekly' | 'bi-weekly';
  };
  records: AttendanceRecord[];
  totals: {
    totalDays: number;
    totalHours: number; // Total clocked hours
    activeTime: number; // Total active time in minutes
    idleTime: number; // Total idle time in minutes
    averageHoursPerDay: number;
    averageActiveTimePerDay: number; // in minutes
    averageIdleTimePerDay: number; // in minutes
  };
  breakdown: Array<{
    date: Date;
    clockIn: Date | null;
    clockOut: Date | null;
    totalHours: number;
    activeTime: number; // in minutes
    idleTime: number; // in minutes
    status: AttendanceRecord['status'];
    approvalStatus: AttendanceRecord['approvalStatus'];
  }>;
} 