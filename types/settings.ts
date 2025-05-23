export interface AttendanceSettings {
  workingHours: {
    start: string
    end: string
  }
  idleThreshold: number
  maxIdlePeriods: number
  allowedLateMinutes: number
  locationRadius: number
  requiredCheckInDays: string[]
  requireManagerApproval: boolean
  autoApproveThreshold: number
}

export interface SystemSettings {
  companyName: string
  timezone: string
  dateFormat: string
  language: string
  emailNotifications: boolean
  smsNotifications: boolean
}

export interface PayrollSettings {
  currency: {
    code: string
    symbol: string
    exchangeRate: number
    lastUpdated: Date
  }
  deductions: {
    tax: {
      enabled: boolean
      percentage: number
    }
    insurance: {
      enabled: boolean
      percentage: number
    }
    other: {
      enabled: boolean
      items: Array<{
        name: string
        percentage: number
      }>
    }
  }
  hourlyRate: {
    enabled: boolean
    baseRate: number
    overtimeMultiplier: number
  }
  idleTime: {
    enabled: boolean
    threshold: number // minutes
    deductionPercentage: number
  }
}

export interface OfficeLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  radius: number; // in meters
  workingHours: {
    start: string;
    end: string;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocationSettings {
  allowedCountries: string[]; // ISO country codes
  defaultCountry: string; // ISO country code
  requireLocationValidation: boolean;
  allowRemoteWork: boolean;
  officeLocations: OfficeLocation[];
  locationValidationRules: {
    requireExactLocation: boolean;
    allowApproximateLocation: boolean;
    minimumAccuracy: number; // in meters
    validateOnCheckIn: boolean;
    validateOnCheckOut: boolean;
  };
}

export interface SettingsData {
  attendance: AttendanceSettings
  system: SystemSettings
  payroll: PayrollSettings
  location: LocationSettings
} 