import { useState, useEffect } from 'react'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { SettingsData, AttendanceSettings, SystemSettings, PayrollSettings, LocationSettings } from '@/types/settings'

const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettings = {
  workingHours: {
    start: "09:00",
    end: "17:00"
  },
  idleThreshold: 15,
  maxIdlePeriods: 3,
  allowedLateMinutes: 15,
  locationRadius: 100,
  requiredCheckInDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  requireManagerApproval: true,
  autoApproveThreshold: 30
}

const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  companyName: "",
  timezone: "UTC",
  dateFormat: "MM/DD/YYYY",
  language: "en",
  emailNotifications: true,
  smsNotifications: false
}

const DEFAULT_PAYROLL_SETTINGS: PayrollSettings = {
  currency: "USD",
  taxRate: 20,
  insuranceRate: 10,
  pensionRate: 5,
  bonusStructure: {
    productivity: {
      enabled: false,
      tiers: []
    },
    attendance: {
      enabled: false,
      tiers: []
    },
    overtime: {
      enabled: false,
      rate: 1.5,
      maxHours: 40
    },
    project: {
      enabled: false,
      completionBonus: 10,
      qualityBonus: 5
    }
  },
  deductions: {
    tax: {
      enabled: true,
      rate: 20,
      minThreshold: 0
    },
    insurance: {
      enabled: true,
      rate: 10,
      types: ['health']
    },
    pension: {
      enabled: true,
      rate: 5,
      employerMatch: 5
    },
    other: {
      enabled: false,
      items: []
    }
  }
}

const DEFAULT_LOCATION_SETTINGS: LocationSettings = {
  allowedCountries: ['GH'],
  defaultCountry: 'GH',
  requireLocationValidation: true,
  allowRemoteWork: false,
  officeLocations: [],
  locationValidationRules: {
    requireExactLocation: true,
    allowApproximateLocation: false,
    minimumAccuracy: 100,
    validateOnCheckIn: true,
    validateOnCheckOut: true
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<AttendanceSettings>(DEFAULT_ATTENDANCE_SETTINGS)
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS)
  const [payrollSettings, setPayrollSettings] = useState<PayrollSettings>(DEFAULT_PAYROLL_SETTINGS)
  const [locationSettings, setLocationSettings] = useState<LocationSettings>(DEFAULT_LOCATION_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, "settings", "company"))
        if (settingsDoc.exists()) {
          const data = settingsDoc.data() as SettingsData
          setSettings({
            ...DEFAULT_ATTENDANCE_SETTINGS,
            ...data.attendance
          })
          setSystemSettings({
            ...DEFAULT_SYSTEM_SETTINGS,
            ...data.system
          })
          setPayrollSettings({
            ...DEFAULT_PAYROLL_SETTINGS,
            ...data.payroll
          })
          setLocationSettings({
            ...DEFAULT_LOCATION_SETTINGS,
            ...data.location
          })
        }
      } catch (err) {
        console.error("Error fetching settings:", err)
        setError(err instanceof Error ? err : new Error('Failed to load settings'))
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [])

  return {
    settings,
    systemSettings,
    payrollSettings,
    locationSettings,
    loading,
    error
  }
} 