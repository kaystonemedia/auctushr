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
  currency: {
    code: "USD",
    symbol: "$",
    exchangeRate: 1,
    lastUpdated: new Date()
  },
  deductions: {
    tax: {
      enabled: true,
      percentage: 20
    },
    insurance: {
      enabled: true,
      percentage: 10
    },
    other: {
      enabled: false,
      items: []
    }
  },
  hourlyRate: {
    enabled: false,
    baseRate: 0,
    overtimeMultiplier: 1.5
  },
  idleTime: {
    enabled: false,
    threshold: 15,
    deductionPercentage: 5
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