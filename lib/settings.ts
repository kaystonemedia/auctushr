import { supabaseAdmin } from './supabase/admin'
import { Settings, PayrollSettings, BonusTier } from '@/types/settings'

export class SettingsService {
  private static instance: SettingsService
  private defaultSettings: Settings

  private constructor() {
    this.defaultSettings = {
      company: {
        name: '',
        timezone: 'America/New_York',
        workingHours: {
          start: '09:00',
          end: '17:00'
        }
      },
      attendance: {
        checkInTime: '09:00',
        checkOutTime: '17:00',
        lateThreshold: 15, // 15 minutes
        earlyLeaveThreshold: 15, // 30 minutes
        overtimeThreshold: 8, // 8 hours
        geolocationRequired: true,
        maxDistance: 100,
        idleTimeSLAThreshold: 3 // 3 minutes default
      },
      productivity: {
        trackingEnabled: true,
        idleThreshold: 10, // 5 minutes
        focusSessionDuration: 25, // 25 minutes
        targetProductiveHours: 8, // 6 hours
        productiveDomains: ['*.work.com', '*.office.com'],
        unproductiveSites: ['*.facebook.com', '*.youtube.com', '*.twitter.com']
      },
      payroll: {
        currency: 'GHS',
        taxRate: 20, // 20%
        insuranceRate: 10, // 10%
        pensionRate: 5, // 5%
        bonusStructure: {
          productivity: {
            enabled: true,
            tiers: [
              { minScore: 90, maxScore: 100, bonusPercentage: 5, description: 'Good Performance' },
              { minScore: 95, maxScore: 100, bonusPercentage: 10, description: 'Excellent Performance' },
              { minScore: 100, maxScore: 100, bonusPercentage: 15, description: 'Outstanding Performance' }
            ]
          },
          attendance: {
            enabled: true,
            tiers: [
              { minRate: 95, maxRate: 100, bonusPercentage: 3, description: 'Good Attendance' },
              { minRate: 98, maxRate: 100, bonusPercentage: 5, description: 'Excellent Attendance' },
              { minRate: 100, maxRate: 100, bonusPercentage: 8, description: 'Perfect Attendance' }
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
      paymentFacilitator: {
        activeProvider: 'paystack',
        providers: {
          paystack: {
            enabled: false, // Will be set dynamically in getSettings
            credentials: {
              secretKey: '',
              publicKey: ''
            },
            settings: {
              defaultCurrency: 'GHS',
              supportedCurrencies: ['NGN', 'GHS', 'USD', 'ZAR'],
              supportedMethods: ['bank_transfer', 'mobile_money', 'ussd', 'card'],
              webhookUrl: '',
              testMode: true
            }
          },
          thunes: {
            enabled: false,
            credentials: {
              apiKey: '',
              secretKey: '',
              clientId: ''
            },
            settings: {
              defaultCurrency: 'USD',
              supportedCurrencies: ['USD', 'EUR', 'GBP', 'NGN', 'GHS', 'KES', 'ZAR'],
              supportedMethods: ['bank_transfer', 'mobile_money', 'wallet'],
              webhookUrl: '',
              testMode: true,
              region: 'global'
            }
          },
          flutterwave: {
            enabled: false,
            credentials: {
              secretKey: '',
              publicKey: '',
              encryptionKey: ''
            },
            settings: {
              defaultCurrency: 'NGN',
              supportedCurrencies: ['NGN', 'GHS', 'USD', 'KES', 'ZAR', 'UGX', 'RWF'],
              supportedMethods: ['bank_transfer', 'mobile_money', 'ussd', 'card'],
              webhookUrl: '',
              testMode: true
            }
          },
          hubtel: {
            enabled: false,
            credentials: {
              clientId: '',
              clientSecret: ''
            },
            settings: {
              defaultCurrency: 'GHS',
              supportedCurrencies: ['GHS'],
              supportedMethods: ['bank_transfer', 'mobile_money', 'card'],
              webhookUrl: '',
              testMode: true
            }
          }
        },
        defaultSettings: {
          currency: 'GHS',
          retryAttempts: 3,
          timeoutSeconds: 30,
          batchSize: 50,
          enableNotifications: true,
          notificationTypes: ['success', 'failure', 'pending']
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
      // Always start with default settings
      let settings = { ...this.defaultSettings }
      
      // Always ensure Paystack settings are up-to-date from environment variables
      if (process.env.PAYSTACK_SECRET_KEY) {
        console.log('Loading Paystack settings from environment variables')
        settings.paymentFacilitator.providers.paystack.enabled = true
        settings.paymentFacilitator.providers.paystack.credentials.secretKey = process.env.PAYSTACK_SECRET_KEY
        settings.paymentFacilitator.providers.paystack.credentials.publicKey = process.env.PAYSTACK_PUBLIC_KEY || ''
        settings.paymentFacilitator.providers.paystack.settings.testMode = process.env.PAYSTACK_SECRET_KEY.startsWith('sk_test_')
        
        console.log('Paystack settings updated:', {
          enabled: settings.paymentFacilitator.providers.paystack.enabled,
          hasSecretKey: !!settings.paymentFacilitator.providers.paystack.credentials.secretKey,
          secretKeyPrefix: settings.paymentFacilitator.providers.paystack.credentials.secretKey.substring(0, 8) + '...',
          testMode: settings.paymentFacilitator.providers.paystack.settings.testMode
        })
      } else {
        console.warn('PAYSTACK_SECRET_KEY not found in environment variables')
      }
      
      // Load persisted settings from Supabase app_settings(key=global)
      try {
        const { data, error } = await supabaseAdmin
          .from('app_settings')
          .select('value')
          .eq('key', 'global')
          .maybeSingle()

        if (error) {
          throw error
        }

        const dbSettings = (data?.value || null) as Partial<Settings> | null
        if (dbSettings) {
          // Deep merge payment facilitators BEFORE merging the rest of settings
          // This ensures new providers (like Hubtel) are always included
          if (dbSettings?.paymentFacilitator?.providers) {
            settings.paymentFacilitator.providers = {
              ...settings.paymentFacilitator.providers,
              ...dbSettings.paymentFacilitator.providers,
              hubtel: dbSettings.paymentFacilitator.providers.hubtel || settings.paymentFacilitator.providers.hubtel
            }
          }

          // Now merge the rest of the settings (this won't overwrite providers since we already merged it)
          settings = {
            ...settings,
            ...dbSettings,
            paymentFacilitator: {
              ...settings.paymentFacilitator,
              ...(dbSettings.paymentFacilitator || {}),
              providers: settings.paymentFacilitator.providers
            }
          }

          // Final safety check: ensure Hubtel provider exists
          if (!settings.paymentFacilitator?.providers?.hubtel) {
            settings.paymentFacilitator.providers.hubtel = this.defaultSettings.paymentFacilitator.providers.hubtel
          }

          // Re-apply environment variables to ensure they take precedence
          if (process.env.PAYSTACK_SECRET_KEY) {
            settings.paymentFacilitator.providers.paystack.enabled = true
            settings.paymentFacilitator.providers.paystack.credentials.secretKey = process.env.PAYSTACK_SECRET_KEY
            settings.paymentFacilitator.providers.paystack.credentials.publicKey = process.env.PAYSTACK_PUBLIC_KEY || ''
            settings.paymentFacilitator.providers.paystack.settings.testMode = process.env.PAYSTACK_SECRET_KEY.startsWith('sk_test_')
          }
        }
      } catch (dbError) {
        console.warn('Error loading settings from database:', dbError)
      }
      
      return settings
    } catch (error) {
      console.error('Error in getSettings:', error)
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
      const { error } = await supabaseAdmin
        .from('app_settings')
        .upsert({ key: 'global', value: updatedSettings }, { onConflict: 'key' })

      if (error) {
        throw error
      }
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
      const { error } = await supabaseAdmin
        .from('app_settings')
        .upsert({ key: 'global', value: updatedSettings }, { onConflict: 'key' })

      if (error) {
        throw error
      }
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
      const bonusStructure = payrollSettings.bonusStructure
      
      if (!bonusStructure[type].enabled) {
        return 0
      }

      if (type === 'productivity') {
        for (const tier of bonusStructure.productivity.tiers) {
          let minValue: number
          let maxValue: number
          
          if (type === 'productivity') {
            minValue = tier.minScore
            maxValue = tier.maxScore
          } else {
            // This shouldn't happen for productivity type, but handle it gracefully
            continue
          }
          
          if (value >= minValue && value <= maxValue) {
            return (baseSalary * tier.bonusPercentage) / 100
          }
        }
      } else if (type === 'attendance') {
        for (const tier of bonusStructure.attendance.tiers) {
          let minValue: number
          let maxValue: number
          
          if (type === 'attendance') {
            minValue = tier.minRate
            maxValue = tier.maxRate
          } else {
            // This shouldn't happen for attendance type, but handle it gracefully
            continue
          }
          
          if (value >= minValue && value <= maxValue) {
            return (baseSalary * tier.bonusPercentage) / 100
          }
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
      const { error } = await supabaseAdmin
        .from('app_settings')
        .upsert({ key: 'global', value: this.defaultSettings }, { onConflict: 'key' })

      if (error) {
        throw error
      }
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