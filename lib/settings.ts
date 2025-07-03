import { db } from './firebase'
import { doc, getDoc, setDoc, updateDoc, collection, getDocs } from 'firebase/firestore'
import { Settings, PayrollSettings, BonusTier, ProductivityBonusTier, AttendanceBonusTier } from '@/types/settings'

export class SettingsService {
  private static instance: SettingsService
  private defaultSettings: Settings

  private constructor() {
    this.defaultSettings = {
      company: {
        name: 'Your Company',
        timezone: 'UTC',
        workingHours: {
          start: '09:00',
          end: '17:00'
        }
      },
      attendance: {
        checkInTime: '09:00',
        checkOutTime: '17:00',
        lateThreshold: 15, // 15 minutes
        earlyLeaveThreshold: 30, // 30 minutes
        overtimeThreshold: 8, // 8 hours
        geolocationRequired: false,
        maxDistance: 1000 // 1km
      },
      productivity: {
        trackingEnabled: true,
        idleThreshold: 5, // 5 minutes
        focusSessionDuration: 25, // 25 minutes
        targetProductiveHours: 6, // 6 hours
        productiveDomains: ['github.com', 'stackoverflow.com', 'docs.google.com'],
        unproductiveSites: ['facebook.com', 'twitter.com', 'instagram.com']
      },
      payroll: {
        currency: 'USD',
        taxRate: 20, // 20%
        insuranceRate: 10, // 10%
        pensionRate: 5, // 5%
        bonusStructure: {
          productivity: {
            enabled: true,
            tiers: [
              {
                minScore: 90,
                maxScore: 100,
                bonusPercentage: 15,
                description: 'Exceptional Performance'
              },
              {
                minScore: 80,
                maxScore: 89,
                bonusPercentage: 10,
                description: 'High Performance'
              },
              {
                minScore: 70,
                maxScore: 79,
                bonusPercentage: 5,
                description: 'Good Performance'
              }
            ]
          },
          attendance: {
            enabled: true,
            tiers: [
              {
                minRate: 95,
                maxRate: 100,
                bonusPercentage: 5,
                description: 'Perfect Attendance'
              },
              {
                minRate: 90,
                maxRate: 94,
                bonusPercentage: 3,
                description: 'Excellent Attendance'
              },
              {
                minRate: 85,
                maxRate: 89,
                bonusPercentage: 1,
                description: 'Good Attendance'
              }
            ]
          },
          overtime: {
            enabled: true,
            rate: 1.5, // time and a half
            maxHours: 40
          },
          project: {
            enabled: false,
            completionBonus: 5, // 5% of base salary
            qualityBonus: 3 // 3% of base salary
          }
        },
        deductions: {
          tax: {
            enabled: true,
            rate: 20, // 20%
            minThreshold: 50000 // $50k minimum
          },
          insurance: {
            enabled: true,
            rate: 10, // 10%
            types: ['health', 'dental', 'vision']
          },
          pension: {
            enabled: true,
            rate: 5, // 5%
            employerMatch: 3 // 3%
          },
          other: {
            enabled: false,
            items: []
          }
        }
      },
      notifications: {
        email: {
          enabled: false,
          from: 'noreply@company.com',
          replyTo: 'hr@company.com',
          smtp: {
            host: '',
            port: 587,
            secure: false,
            username: '',
            password: ''
          }
        },
        sms: {
          enabled: false,
          provider: 'Twilio',
          apiKey: '',
          apiSecret: ''
        },
        push: {
          enabled: false,
          vapidPublicKey: '',
          vapidPrivateKey: ''
        },
        types: {
          attendance: true,
          productivity: true,
          payroll: true,
          leave: true,
          performance: true
        }
      },
      security: {
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: false,
          maxAge: 90, // 90 days
          historyCount: 5
        },
        sessionManagement: {
          timeout: 480, // 8 hours
          maxConcurrent: 3
        },
        twoFactor: {
          enabled: false,
          defaultMethod: 'TOTP',
          backupCodesCount: 10
        },
        ipWhitelist: []
      },
      integrations: {
        slack: {
          enabled: false,
          webhookUrl: '',
          channels: []
        },
        googleWorkspace: {
          enabled: false,
          clientId: '',
          clientSecret: ''
        },
        microsoft365: {
          enabled: false,
          clientId: '',
          clientSecret: ''
        }
      }
    }
  }

  static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService()
    }
    return SettingsService.instance
  }

  /**
   * Get all settings
   */
  async getSettings(): Promise<Settings> {
    try {
      const settingsDoc = await getDoc(doc(db, 'settings', 'global'))
      if (settingsDoc.exists()) {
        return { ...this.defaultSettings, ...settingsDoc.data() } as Settings
      }
      return this.defaultSettings
    } catch (error) {
      console.error('Error fetching settings:', error)
      return this.defaultSettings
    }
  }

  /**
   * Update settings
   */
  async updateSettings(settings: Partial<Settings>): Promise<void> {
    try {
      const currentSettings = await this.getSettings()
      const updatedSettings = { ...currentSettings, ...settings }
      await setDoc(doc(db, 'settings', 'global'), updatedSettings)
    } catch (error) {
      console.error('Error updating settings:', error)
      throw error
    }
  }

  /**
   * Get payroll settings specifically
   */
  async getPayrollSettings(): Promise<PayrollSettings> {
    const settings = await this.getSettings()
    return settings.payroll
  }

  /**
   * Update payroll settings
   */
  async updatePayrollSettings(payrollSettings: Partial<PayrollSettings>): Promise<void> {
    try {
      const currentSettings = await this.getSettings()
      const updatedSettings = {
        ...currentSettings,
        payroll: { ...currentSettings.payroll, ...payrollSettings }
      }
      await setDoc(doc(db, 'settings', 'global'), updatedSettings)
    } catch (error) {
      console.error('Error updating payroll settings:', error)
      throw error
    }
  }

  /**
   * Get productivity bonus tiers
   */
  async getProductivityBonusTiers(): Promise<BonusTier[]> {
    const payrollSettings = await this.getPayrollSettings()
    return payrollSettings.bonusStructure.productivity.tiers.map(tier => ({
      minValue: tier.minScore,
      maxValue: tier.maxScore,
      bonusPercentage: tier.bonusPercentage,
      description: tier.description
    }))
  }

  /**
   * Get attendance bonus tiers
   */
  async getAttendanceBonusTiers(): Promise<BonusTier[]> {
    const payrollSettings = await this.getPayrollSettings()
    return payrollSettings.bonusStructure.attendance.tiers.map(tier => ({
      minValue: tier.minRate,
      maxValue: tier.maxRate,
      bonusPercentage: tier.bonusPercentage,
      description: tier.description
    }))
  }

  /**
   * Calculate bonus based on current settings
   */
  async calculateBonus(
    type: 'productivity' | 'attendance',
    value: number,
    baseSalary: number
  ): Promise<number> {
    try {
      const payrollSettings = await this.getPayrollSettings()
      const bonusConfig = payrollSettings.bonusStructure[type]
      
      if (!bonusConfig.enabled) {
        return 0
      }

      const tiers = bonusConfig.tiers
      for (const tier of tiers) {
        let minValue: number
        let maxValue: number
        
        if (type === 'productivity') {
          const productivityTier = tier as ProductivityBonusTier
          minValue = productivityTier.minScore
          maxValue = productivityTier.maxScore
        } else {
          const attendanceTier = tier as AttendanceBonusTier
          minValue = attendanceTier.minRate
          maxValue = attendanceTier.maxRate
        }
        
        if (value >= minValue && value <= maxValue) {
          return (baseSalary * tier.bonusPercentage) / 100
        }
      }
      
      return 0
    } catch (error) {
      console.error(`Error calculating ${type} bonus:`, error)
      return 0
    }
  }

  /**
   * Calculate productivity bonus
   */
  async calculateProductivityBonus(productivityScore: number, baseSalary: number): Promise<number> {
    return this.calculateBonus('productivity', productivityScore, baseSalary)
  }

  /**
   * Calculate attendance bonus
   */
  async calculateAttendanceBonus(attendanceRate: number, baseSalary: number): Promise<number> {
    return this.calculateBonus('attendance', attendanceRate, baseSalary)
  }

  /**
   * Calculate overtime pay
   */
  async calculateOvertimePay(regularHours: number, overtimeHours: number, hourlyRate: number): Promise<number> {
    try {
      const payrollSettings = await this.getPayrollSettings()
      const overtimeConfig = payrollSettings.bonusStructure.overtime
      
      if (!overtimeConfig.enabled || overtimeHours <= 0) {
        return 0
      }

      const maxOvertimeHours = Math.min(overtimeHours, overtimeConfig.maxHours - regularHours)
      return maxOvertimeHours * hourlyRate * overtimeConfig.rate
    } catch (error) {
      console.error('Error calculating overtime pay:', error)
      return 0
    }
  }

  /**
   * Calculate deductions
   */
  async calculateDeductions(baseSalary: number, grossSalary: number): Promise<{
    tax: number
    insurance: number
    pension: number
    other: number
    total: number
  }> {
    try {
      const payrollSettings = await this.getPayrollSettings()
      const deductions = payrollSettings.deductions
      
      let tax = 0
      if (deductions.tax.enabled && grossSalary >= deductions.tax.minThreshold) {
        tax = (grossSalary * deductions.tax.rate) / 100
      }

      let insurance = 0
      if (deductions.insurance.enabled) {
        insurance = (baseSalary * deductions.insurance.rate) / 100
      }

      let pension = 0
      if (deductions.pension.enabled) {
        pension = (baseSalary * deductions.pension.rate) / 100
      }

      let other = 0
      if (deductions.other.enabled) {
        other = deductions.other.items.reduce((total, item) => {
          return total + ((baseSalary * item.rate) / 100)
        }, 0)
      }

      const total = tax + insurance + pension + other

      return {
        tax,
        insurance,
        pension,
        other,
        total
      }
    } catch (error) {
      console.error('Error calculating deductions:', error)
      return {
        tax: 0,
        insurance: 0,
        pension: 0,
        other: 0,
        total: 0
      }
    }
  }

  /**
   * Reset settings to defaults
   */
  async resetToDefaults(): Promise<void> {
    try {
      await setDoc(doc(db, 'settings', 'global'), this.defaultSettings)
    } catch (error) {
      console.error('Error resetting settings:', error)
      throw error
    }
  }

  /**
   * Export settings
   */
  async exportSettings(): Promise<string> {
    const settings = await this.getSettings()
    return JSON.stringify(settings, null, 2)
  }

  /**
   * Import settings
   */
  async importSettings(settingsJson: string): Promise<void> {
    try {
      const settings = JSON.parse(settingsJson) as Settings
      await this.updateSettings(settings)
    } catch (error) {
      console.error('Error importing settings:', error)
      throw new Error('Invalid settings format')
    }
  }
}

// Export singleton instance
export const settingsService = SettingsService.getInstance() 