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

export interface Settings {
  company: {
    name: string
    logo?: string
    timezone: string
    workingHours: {
      start: string
      end: string
    }
  }
  attendance: {
    checkInTime: string
    checkOutTime: string
    lateThreshold: number // minutes
    earlyLeaveThreshold: number // minutes
    overtimeThreshold: number // hours
    geolocationRequired: boolean
    maxDistance: number // meters
  }
  productivity: {
    trackingEnabled: boolean
    idleThreshold: number // minutes
    focusSessionDuration: number // minutes
    targetProductiveHours: number
    productiveDomains: string[]
    unproductiveSites: string[]
  }
  payroll: PayrollSettings
  notifications: {
    email: {
      enabled: boolean
      from: string
      replyTo: string
      smtp: {
        host: string
        port: number
        secure: boolean
        username: string
        password: string
      }
    }
    sms: {
      enabled: boolean
      provider: string
      apiKey: string
      apiSecret: string
    }
    push: {
      enabled: boolean
      vapidPublicKey: string
      vapidPrivateKey: string
    }
    types: {
      attendance: boolean
      productivity: boolean
      payroll: boolean
      leave: boolean
      performance: boolean
    }
  }
  security: {
    passwordPolicy: {
      minLength: number
      requireUppercase: boolean
      requireLowercase: boolean
      requireNumbers: boolean
      requireSpecialChars: boolean
      maxAge: number // days
      historyCount: number
    }
    sessionManagement: {
      timeout: number // minutes
      maxConcurrent: number
    }
    twoFactor: {
      enabled: boolean
      defaultMethod: string
      backupCodesCount: number
    }
    ipWhitelist: string[]
  }
  integrations: {
    slack: {
      enabled: boolean
      webhookUrl: string
      channels: string[]
    }
    googleWorkspace: {
      enabled: boolean
      clientId: string
      clientSecret: string
    }
    microsoft365: {
      enabled: boolean
      clientId: string
      clientSecret: string
    }
  }
}

export interface BonusTier {
  minValue: number
  maxValue: number
  bonusPercentage: number
  description: string
}

export interface PayrollSettings {
  currency: string
  taxRate: number // percentage
  insuranceRate: number // percentage
  pensionRate: number // percentage
  bonusStructure: {
    productivity: {
      enabled: boolean
      tiers: Array<{
        minScore: number
        maxScore: number
        bonusPercentage: number
        description: string
      }>
    }
    attendance: {
      enabled: boolean
      tiers: Array<{
        minRate: number
        maxRate: number
        bonusPercentage: number
        description: string
      }>
    }
    overtime: {
      enabled: boolean
      rate: number // multiplier (e.g., 1.5 for time and a half)
      maxHours: number
    }
    project: {
      enabled: boolean
      completionBonus: number // percentage of base salary
      qualityBonus: number // percentage of base salary
    }
  }
  deductions: {
    tax: {
      enabled: boolean
      rate: number // percentage
      minThreshold: number // minimum salary for tax
    }
    insurance: {
      enabled: boolean
      rate: number // percentage
      types: string[] // health, dental, vision, etc.
    }
    pension: {
      enabled: boolean
      rate: number // percentage
      employerMatch: number // percentage
    }
    other: {
      enabled: boolean
      items: Array<{
        name: string
        rate: number
        description: string
      }>
    }
  }
} 