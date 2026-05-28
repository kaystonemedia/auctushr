import { Settings } from '@/types/settings'

export class SettingsClientService {
  private static instance: SettingsClientService
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
        lateThreshold: 15,
        earlyLeaveThreshold: 15,
        overtimeThreshold: 8,
        geolocationRequired: true,
        maxDistance: 100,
        idleTimeSLAThreshold: 3
      },
      productivity: {
        trackingEnabled: true,
        idleThreshold: 10,
        focusSessionDuration: 25,
        targetProductiveHours: 8,
        productiveDomains: ['*.work.com', '*.office.com'],
        unproductiveSites: ['*.facebook.com', '*.youtube.com', '*.twitter.com']
      },
      payroll: {
        currency: 'GHS',
        taxRate: 20,
        insuranceRate: 10,
        pensionRate: 5,
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
            rate: 1.5,
            maxHours: 40
          },
          project: {
            enabled: false,
            completionBonus: 5,
            qualityBonus: 3
          }
        },
        deductions: {
          tax: {
            enabled: true,
            rate: 20,
            minThreshold: 50000
          },
          insurance: {
            enabled: true,
            rate: 10,
            types: ['health', 'dental', 'vision']
          },
          pension: {
            enabled: true,
            rate: 5,
            employerMatch: 3
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
            enabled: true,
            credentials: {
              secretKey: process.env.PAYSTACK_SECRET_KEY || '',
              publicKey: process.env.PAYSTACK_PUBLIC_KEY || ''
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
              defaultCurrency: 'GHS',
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
          maxAge: 90,
          historyCount: 5
        },
        sessionManagement: {
          timeout: 480,
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

  static getInstance(): SettingsClientService {
    if (!SettingsClientService.instance) {
      SettingsClientService.instance = new SettingsClientService()
    }
    return SettingsClientService.instance
  }

  /**
   * Get settings from API
   */
  async getSettings(): Promise<Settings> {
    try {
      const response = await fetch('/api/settings')
      if (!response.ok) {
        throw new Error(`Failed to fetch settings: ${response.status}`)
      }
      const data = await response.json()
      return data.settings
    } catch (error) {
      console.error('Error fetching settings:', error)
      return this.defaultSettings
    }
  }

  /**
   * Update settings via API
   */
  async updateSettings(settings: Partial<Settings>): Promise<void> {
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings)
      })
      
      if (!response.ok) {
        throw new Error(`Failed to update settings: ${response.status}`)
      }
    } catch (error) {
      console.error('Error updating settings:', error)
      throw error
    }
  }

  /**
   * Get default settings
   */
  getDefaultSettings(): Settings {
    return { ...this.defaultSettings }
  }

  /**
   * Get payroll settings specifically
   */
  async getPayrollSettings() {
    const settings = await this.getSettings()
    return settings.payroll
  }

  /**
   * Calculate productivity bonus
   */
  async calculateProductivityBonus(productivityScore: number, baseSalary: number): Promise<number> {
    try {
      const settings = await this.getSettings()
      const bonusStructure = settings.payroll.bonusStructure.productivity
      
      if (!bonusStructure.enabled) {
        return 0
      }

      for (const tier of bonusStructure.tiers) {
        if (productivityScore >= tier.minScore && productivityScore <= tier.maxScore) {
          return (baseSalary * tier.bonusPercentage) / 100
        }
      }
      
      return 0
    } catch (error) {
      console.error('Error calculating productivity bonus:', error)
      return 0
    }
  }

  /**
   * Calculate attendance bonus
   */
  async calculateAttendanceBonus(attendanceRate: number, baseSalary: number): Promise<number> {
    try {
      const settings = await this.getSettings()
      const bonusStructure = settings.payroll.bonusStructure.attendance
      
      if (!bonusStructure.enabled) {
        return 0
      }

      for (const tier of bonusStructure.tiers) {
        if (attendanceRate >= tier.minRate && attendanceRate <= tier.maxRate) {
          return (baseSalary * tier.bonusPercentage) / 100
        }
      }
      
      return 0
    } catch (error) {
      console.error('Error calculating attendance bonus:', error)
      return 0
    }
  }

  /**
   * Calculate overtime pay
   */
  async calculateOvertimePay(regularHours: number, overtimeHours: number, hourlyRate: number): Promise<number> {
    try {
      const settings = await this.getSettings()
      const overtimeConfig = settings.payroll.bonusStructure.overtime
      
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
      const settings = await this.getSettings()
      const deductions = settings.payroll.deductions
      
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
}

// Export singleton instance
export const settingsClientService = SettingsClientService.getInstance()
