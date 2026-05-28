'use client'

import { useState, useEffect } from 'react'
import { useNewAuth } from '@/contexts/new-auth-context'
import { SettingsClientService } from '@/lib/settings-client'
import { Settings, PayrollSettings, ProductivityBonusTier, AttendanceBonusTier } from '@/types/settings'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { 
  Save, 
  RefreshCw, 
  Download, 
  Upload, 
  Plus, 
  Trash2, 
  Settings as SettingsIcon,
  DollarSign,
  TrendingUp,
  Clock,
  Users,
  Shield,
  Bell,
  Globe,
  MapPin,
  Target,
  AlertCircle,
  CreditCard,
  Key,
  Check,
  X
} from 'lucide-react'
import { toast } from '@/components/ui/use-toast'
import { cleanupInvalidNotifications } from '@/lib/notifications'
import { ToolsPolicySettings } from '@/components/settings/tools-policy-settings'

export default function SettingsPage() {
  const { user } = useNewAuth()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingEmail, setTestingEmail] = useState(false)
  const [testEmailAddress, setTestEmailAddress] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const currentSettings = await SettingsClientService.getInstance().getSettings()
      setSettings(currentSettings)
    } catch (error) {
      console.error('Error loading settings:', error)
      toast({
        title: "Error",
        description: "Failed to load settings",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    if (!settings) return
    
    setSaving(true)
    try {
      await SettingsClientService.getInstance().updateSettings(settings)
      toast({
        title: "Success",
        description: "Settings saved successfully"
      })
    } catch (error) {
      console.error('Error saving settings:', error)
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const resetToDefaults = async () => {
    if (!confirm('Are you sure you want to reset all settings to defaults?')) return
    
    setSaving(true)
    try {
      const defaultSettings = SettingsClientService.getInstance().getDefaultSettings()
      setSettings(defaultSettings)
      toast({
        title: "Success",
        description: "Settings reset to defaults"
      })
    } catch (error) {
      console.error('Error resetting settings:', error)
      toast({
        title: "Error",
        description: "Failed to reset settings",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const exportSettings = async () => {
    try {
      if (!settings) return
      const settingsJson = JSON.stringify(settings, null, 2)
      const blob = new Blob([settingsJson], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'hr-settings.json'
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting settings:', error)
      toast({
        title: "Error",
        description: "Failed to export settings",
        variant: "destructive"
      })
    }
  }

  const importSettings = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const importedSettings = JSON.parse(text) as Settings
      await SettingsClientService.getInstance().updateSettings(importedSettings)
      await loadSettings()
      toast({
        title: "Success",
        description: "Settings imported successfully"
      })
    } catch (error) {
      console.error('Error importing settings:', error)
      toast({
        title: "Error",
        description: "Failed to import settings",
        variant: "destructive"
      })
    }
  }

  const updatePayrollSettings = (updates: Partial<PayrollSettings>) => {
    if (!settings) return
    setSettings({
      ...settings,
      payroll: { ...settings.payroll, ...updates }
    })
  }

  const updateAttendanceSettings = (updates: Partial<Settings['attendance']>) => {
    if (!settings) return
    setSettings({
      ...settings,
      attendance: { ...settings.attendance, ...updates }
    })
  }

  const updateProductivitySettings = (updates: Partial<Settings['productivity']>) => {
    if (!settings) return
    setSettings({
      ...settings,
      productivity: { ...settings.productivity, ...updates }
    })
  }

  const updatePaymentFacilitatorSettings = (updates: Partial<Settings['paymentFacilitator']>) => {
    if (!settings) return
    setSettings({
      ...settings,
      paymentFacilitator: { ...settings.paymentFacilitator, ...updates }
    })
  }

  const updatePaymentProvider = (
    provider: 'paystack' | 'thunes' | 'flutterwave' | 'hubtel',
    updates: Partial<Settings['paymentFacilitator']['providers'][typeof provider]>
  ) => {
    if (!settings) return
    setSettings({
      ...settings,
      paymentFacilitator: {
        ...settings.paymentFacilitator,
        providers: {
          ...settings.paymentFacilitator.providers,
          [provider]: {
            ...settings.paymentFacilitator.providers[provider],
            ...updates
          }
        }
      }
    })
  }

  const updateNotificationSettings = (updates: Partial<Settings['notifications']>) => {
    if (!settings) return
    setSettings({
      ...settings,
      notifications: { ...settings.notifications, ...updates }
    })
  }

  const updateSecuritySettings = (updates: Partial<Settings['security']>) => {
    if (!settings) return
    setSettings({
      ...settings,
      security: { ...settings.security, ...updates }
    })
  }

  const handleCleanupNotifications = async () => {
    if (!confirm('This will remove all notifications with invalid data. Are you sure?')) return
    
    setSaving(true)
    try {
      await cleanupInvalidNotifications()
      toast({
        title: "Success",
        description: "Invalid notifications cleaned up successfully"
      })
    } catch (error) {
      console.error('Error cleaning up notifications:', error)
      toast({
        title: "Error",
        description: "Failed to clean up notifications",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const addBonusTier = (type: 'productivity' | 'attendance') => {
    if (!settings) return

    if (type === 'productivity') {
      const newTier: ProductivityBonusTier = {
        minScore: 0,
        maxScore: 100,
        bonusPercentage: 5,
        description: 'New Tier'
      }

      const updatedTiers = [...settings.payroll.bonusStructure[type].tiers, newTier]
      
      updatePayrollSettings({
        bonusStructure: {
          ...settings.payroll.bonusStructure,
          [type]: {
            ...settings.payroll.bonusStructure[type],
            tiers: updatedTiers
          }
        }
      })
    } else {
      const newTier: AttendanceBonusTier = {
        minRate: 0,
        maxRate: 100,
        bonusPercentage: 5,
        description: 'New Tier'
      }

      const updatedTiers = [...settings.payroll.bonusStructure[type].tiers, newTier]
      
      updatePayrollSettings({
        bonusStructure: {
          ...settings.payroll.bonusStructure,
          [type]: {
            ...settings.payroll.bonusStructure[type],
            tiers: updatedTiers
          }
        }
      })
    }
  }

  const removeBonusTier = (type: 'productivity' | 'attendance', index: number) => {
    if (!settings) return

    const updatedTiers = settings.payroll.bonusStructure[type].tiers.filter((_, i) => i !== index)
    
    updatePayrollSettings({
      bonusStructure: {
        ...settings.payroll.bonusStructure,
        [type]: {
          ...settings.payroll.bonusStructure[type],
          tiers: updatedTiers
        }
      }
    })
  }

  const updateBonusTier = (type: 'productivity' | 'attendance', index: number, updates: Partial<ProductivityBonusTier | AttendanceBonusTier>) => {
    if (!settings) return

    const updatedTiers = settings.payroll.bonusStructure[type].tiers.map((tier, i) => 
      i === index ? { ...tier, ...updates } : tier
    )
    
    updatePayrollSettings({
      bonusStructure: {
        ...settings.payroll.bonusStructure,
        [type]: {
          ...settings.payroll.bonusStructure[type],
          tiers: updatedTiers
        }
      }
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading settings...</p>
        </div>
      </div>
    )
  }

  if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Shield className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access settings.</p>
        </div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <SettingsIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Settings Not Found</h1>
          <p className="text-gray-600">Unable to load system settings.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col space-y-4 mb-8 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">System Settings</h1>
          <p className="text-gray-600 mt-2 text-sm md:text-base">
            Configure system-wide settings and bonus structures
          </p>
        </div>
        <div className="flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-2">
          <Button variant="outline" onClick={exportSettings} size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" onClick={resetToDefaults} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button onClick={saveSettings} disabled={saving} size="sm">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="payroll" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-1 h-auto">
          <TabsTrigger value="payroll" className="flex items-center justify-center space-x-1 md:space-x-2 px-2 py-2 text-xs md:text-sm">
            <DollarSign className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Payroll</span>
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center justify-center space-x-1 md:space-x-2 px-2 py-2 text-xs md:text-sm">
            <CreditCard className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Payments</span>
          </TabsTrigger>
          <TabsTrigger value="company" className="flex items-center justify-center space-x-1 md:space-x-2 px-2 py-2 text-xs md:text-sm">
            <Users className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Company</span>
          </TabsTrigger>
          <TabsTrigger value="attendance" className="flex items-center justify-center space-x-1 md:space-x-2 px-2 py-2 text-xs md:text-sm">
            <Clock className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Attendance</span>
          </TabsTrigger>
          <TabsTrigger value="productivity" className="flex items-center justify-center space-x-1 md:space-x-2 px-2 py-2 text-xs md:text-sm">
            <TrendingUp className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Productivity</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center justify-center space-x-1 md:space-x-2 px-2 py-2 text-xs md:text-sm">
            <Bell className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center justify-center space-x-1 md:space-x-2 px-2 py-2 text-xs md:text-sm">
            <Shield className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="payroll" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payroll Configuration</CardTitle>
              <CardDescription>
                Configure payroll settings, bonus structures, and deductions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Payroll Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Input
                    id="currency"
                    value={settings.payroll.currency}
                    onChange={(e) => updatePayrollSettings({ currency: e.target.value })}
                    placeholder="USD"
                  />
                </div>
                <div>
                  <Label htmlFor="taxRate">Default Tax Rate (%)</Label>
                  <Input
                    id="taxRate"
                    type="number"
                    value={settings.payroll.taxRate}
                    onChange={(e) => updatePayrollSettings({ taxRate: Number(e.target.value) })}
                    placeholder="20"
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-1">
                  <Label htmlFor="insuranceRate">Default Insurance Rate (%)</Label>
                  <Input
                    id="insuranceRate"
                    type="number"
                    value={settings.payroll.insuranceRate}
                    onChange={(e) => updatePayrollSettings({ insuranceRate: Number(e.target.value) })}
                    placeholder="10"
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-1">
                  <Label htmlFor="exchangeRate">Exchange Rate</Label>
                  <Input
                    id="exchangeRate"
                    type="number"
                    step="0.0001"
                    value={settings.payroll.exchangeRate ?? ''}
                    onChange={(e) => updatePayrollSettings({ exchangeRate: Number(e.target.value) })}
                    placeholder="1.00"
                  />
                </div>
              </div>

              <Separator />

              {/* Productivity Bonus Structure */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">Productivity Bonus Structure</h3>
                    <p className="text-sm text-gray-600">
                      Configure bonus tiers based on productivity scores
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={settings.payroll.bonusStructure.productivity.enabled}
                      onCheckedChange={(checked) => updatePayrollSettings({
                        bonusStructure: {
                          ...settings.payroll.bonusStructure,
                          productivity: {
                            ...settings.payroll.bonusStructure.productivity,
                            enabled: checked
                          }
                        }
                      })}
                    />
                    <Label>Enabled</Label>
                  </div>
                </div>

                {settings.payroll.bonusStructure.productivity.enabled && (
                  <div className="space-y-4">
                    {settings.payroll.bonusStructure.productivity.tiers.map((tier, index) => (
                      <Card key={index} className="p-4">
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                              <Label>Min Score</Label>
                              <Input
                                type="number"
                                value={tier.minScore}
                                onChange={(e) => updateBonusTier('productivity', index, { minScore: Number(e.target.value) })}
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <Label>Max Score</Label>
                              <Input
                                type="number"
                                value={tier.maxScore}
                                onChange={(e) => updateBonusTier('productivity', index, { maxScore: Number(e.target.value) })}
                                placeholder="100"
                              />
                            </div>
                            <div>
                              <Label>Bonus (%)</Label>
                              <Input
                                type="number"
                                value={tier.bonusPercentage}
                                onChange={(e) => updateBonusTier('productivity', index, { bonusPercentage: Number(e.target.value) })}
                                placeholder="5"
                              />
                            </div>
                            <div>
                              <Label>Description</Label>
                              <Input
                                value={tier.description}
                                onChange={(e) => updateBonusTier('productivity', index, { description: e.target.value })}
                                placeholder="High Performance"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <Badge variant="secondary">
                              {tier.minScore}-{tier.maxScore}%
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeBonusTier('productivity', index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                    <Button
                      variant="outline"
                      onClick={() => addBonusTier('productivity')}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Productivity Tier
                    </Button>
                  </div>
                )}
              </div>

              <Separator />

              {/* Attendance Bonus Structure */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">Attendance Bonus Structure</h3>
                    <p className="text-sm text-gray-600">
                      Configure bonus tiers based on attendance rates
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={settings.payroll.bonusStructure.attendance.enabled}
                      onCheckedChange={(checked) => updatePayrollSettings({
                        bonusStructure: {
                          ...settings.payroll.bonusStructure,
                          attendance: {
                            ...settings.payroll.bonusStructure.attendance,
                            enabled: checked
                          }
                        }
                      })}
                    />
                    <Label>Enabled</Label>
                  </div>
                </div>

                {settings.payroll.bonusStructure.attendance.enabled && (
                  <div className="space-y-4">
                    {settings.payroll.bonusStructure.attendance.tiers.map((tier, index) => (
                      <Card key={index} className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                          <div>
                            <Label>Min Rate (%)</Label>
                            <Input
                              type="number"
                              value={tier.minRate}
                              onChange={(e) => updateBonusTier('attendance', index, { minRate: Number(e.target.value) })}
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <Label>Max Rate (%)</Label>
                            <Input
                              type="number"
                              value={tier.maxRate}
                              onChange={(e) => updateBonusTier('attendance', index, { maxRate: Number(e.target.value) })}
                              placeholder="100"
                            />
                          </div>
                          <div>
                            <Label>Bonus (%)</Label>
                            <Input
                              type="number"
                              value={tier.bonusPercentage}
                              onChange={(e) => updateBonusTier('attendance', index, { bonusPercentage: Number(e.target.value) })}
                              placeholder="5"
                            />
                          </div>
                          <div>
                            <Label>Description</Label>
                            <Input
                              value={tier.description}
                              onChange={(e) => updateBonusTier('attendance', index, { description: e.target.value })}
                              placeholder="Perfect Attendance"
                            />
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant="secondary">
                              {tier.minRate}-{tier.maxRate}%
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeBonusTier('attendance', index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                    <Button
                      variant="outline"
                      onClick={() => addBonusTier('attendance')}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Attendance Tier
                    </Button>
                  </div>
                )}
              </div>

              <Separator />

              {/* Overtime Settings */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">Overtime Settings</h3>
                    <p className="text-sm text-gray-600">
                      Configure overtime pay rates and limits
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={settings.payroll.bonusStructure.overtime.enabled}
                      onCheckedChange={(checked) => updatePayrollSettings({
                        bonusStructure: {
                          ...settings.payroll.bonusStructure,
                          overtime: {
                            ...settings.payroll.bonusStructure.overtime,
                            enabled: checked
                          }
                        }
                      })}
                    />
                    <Label>Enabled</Label>
                  </div>
                </div>

                {settings.payroll.bonusStructure.overtime.enabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="overtimeRate">Overtime Rate (multiplier)</Label>
                      <Input
                        id="overtimeRate"
                        type="number"
                        step="0.1"
                        value={settings.payroll.bonusStructure.overtime.rate}
                        onChange={(e) => updatePayrollSettings({
                          bonusStructure: {
                            ...settings.payroll.bonusStructure,
                            overtime: {
                              ...settings.payroll.bonusStructure.overtime,
                              rate: Number(e.target.value)
                            }
                          }
                        })}
                        placeholder="1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="maxOvertimeHours">Max Overtime Hours</Label>
                      <Input
                        id="maxOvertimeHours"
                        type="number"
                        value={settings.payroll.bonusStructure.overtime.maxHours}
                        onChange={(e) => updatePayrollSettings({
                          bonusStructure: {
                            ...settings.payroll.bonusStructure,
                            overtime: {
                              ...settings.payroll.bonusStructure.overtime,
                              maxHours: Number(e.target.value)
                            }
                          }
                        })}
                        placeholder="40"
                      />
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Deductions Configuration */}
              <div className="space-y-6">
                <h3 className="text-lg font-medium">Payroll Deductions</h3>
                
                {/* Tax Deductions */}
                <Card className="p-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Tax Deductions</h4>
                        <p className="text-sm text-gray-600">Configure tax rates and thresholds</p>
                      </div>
                      <Switch
                        checked={settings.payroll.deductions.tax.enabled}
                        onCheckedChange={(checked) => updatePayrollSettings({
                          deductions: {
                            ...settings.payroll.deductions,
                            tax: {
                              ...settings.payroll.deductions.tax,
                              enabled: checked
                            }
                          }
                        })}
                      />
                    </div>
                    
                    {settings.payroll.deductions.tax.enabled && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="taxRate">Tax Rate (%)</Label>
                          <Input
                            id="taxRate"
                            type="number"
                            step="0.1"
                            value={settings.payroll.deductions.tax.rate}
                            onChange={(e) => updatePayrollSettings({
                              deductions: {
                                ...settings.payroll.deductions,
                                tax: {
                                  ...settings.payroll.deductions.tax,
                                  rate: Number(e.target.value)
                                }
                              }
                            })}
                            placeholder="20"
                          />
                        </div>
                        <div>
                          <Label htmlFor="taxThreshold">Minimum Threshold ($)</Label>
                          <Input
                            id="taxThreshold"
                            type="number"
                            value={settings.payroll.deductions.tax.minThreshold}
                            onChange={(e) => updatePayrollSettings({
                              deductions: {
                                ...settings.payroll.deductions,
                                tax: {
                                  ...settings.payroll.deductions.tax,
                                  minThreshold: Number(e.target.value)
                                }
                              }
                            })}
                            placeholder="50000"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Insurance Deductions */}
                <Card className="p-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Insurance Deductions</h4>
                        <p className="text-sm text-gray-600">Configure insurance types and rates</p>
                      </div>
                      <Switch
                        checked={settings.payroll.deductions.insurance.enabled}
                        onCheckedChange={(checked) => updatePayrollSettings({
                          deductions: {
                            ...settings.payroll.deductions,
                            insurance: {
                              ...settings.payroll.deductions.insurance,
                              enabled: checked
                            }
                          }
                        })}
                      />
                    </div>
                    
                    {settings.payroll.deductions.insurance.enabled && (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="insuranceRate">Insurance Rate (%)</Label>
                          <Input
                            id="insuranceRate"
                            type="number"
                            step="0.1"
                            value={settings.payroll.deductions.insurance.rate}
                            onChange={(e) => updatePayrollSettings({
                              deductions: {
                                ...settings.payroll.deductions,
                                insurance: {
                                  ...settings.payroll.deductions.insurance,
                                  rate: Number(e.target.value)
                                }
                              }
                            })}
                            placeholder="10"
                          />
                        </div>
                        <div>
                          <Label>Insurance Types</Label>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {settings.payroll.deductions.insurance.types.map((type, index) => (
                              <Badge key={index} variant="secondary" className="flex items-center gap-1">
                                {type}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-4 w-4 p-0 hover:bg-red-100"
                                  onClick={() => {
                                    const newTypes = settings.payroll.deductions.insurance.types.filter((_, i) => i !== index)
                                    updatePayrollSettings({
                                      deductions: {
                                        ...settings.payroll.deductions,
                                        insurance: {
                                          ...settings.payroll.deductions.insurance,
                                          types: newTypes
                                        }
                                      }
                                    })
                                  }}
                                >
                                  ×
                                </Button>
                              </Badge>
                            ))}
                          </div>
                          <div className="flex gap-2 mt-2">
                            <Input
                              placeholder="Add insurance type (e.g., health, dental, vision)"
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  const value = e.currentTarget.value.trim()
                                  if (value && !settings.payroll.deductions.insurance.types.includes(value)) {
                                    updatePayrollSettings({
                                      deductions: {
                                        ...settings.payroll.deductions,
                                        insurance: {
                                          ...settings.payroll.deductions.insurance,
                                          types: [...settings.payroll.deductions.insurance.types, value]
                                        }
                                      }
                                    })
                                    e.currentTarget.value = ''
                                  }
                                }
                              }}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                const input = e.currentTarget.previousElementSibling as HTMLInputElement
                                const value = input.value.trim()
                                if (value && !settings.payroll.deductions.insurance.types.includes(value)) {
                                  updatePayrollSettings({
                                    deductions: {
                                      ...settings.payroll.deductions,
                                      insurance: {
                                        ...settings.payroll.deductions.insurance,
                                        types: [...settings.payroll.deductions.insurance.types, value]
                                      }
                                    }
                                  })
                                  input.value = ''
                                }
                              }}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Pension Deductions */}
                <Card className="p-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Pension Deductions</h4>
                        <p className="text-sm text-gray-600">Configure pension contributions</p>
                      </div>
                      <Switch
                        checked={settings.payroll.deductions.pension.enabled}
                        onCheckedChange={(checked) => updatePayrollSettings({
                          deductions: {
                            ...settings.payroll.deductions,
                            pension: {
                              ...settings.payroll.deductions.pension,
                              enabled: checked
                            }
                          }
                        })}
                      />
                    </div>
                    
                    {settings.payroll.deductions.pension.enabled && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="pensionRate">Pension Rate (%)</Label>
                          <Input
                            id="pensionRate"
                            type="number"
                            step="0.1"
                            value={settings.payroll.deductions.pension.rate}
                            onChange={(e) => updatePayrollSettings({
                              deductions: {
                                ...settings.payroll.deductions,
                                pension: {
                                  ...settings.payroll.deductions.pension,
                                  rate: Number(e.target.value)
                                }
                              }
                            })}
                            placeholder="5"
                          />
                        </div>
                        <div>
                          <Label htmlFor="employerMatch">Employer Match (%)</Label>
                          <Input
                            id="employerMatch"
                            type="number"
                            step="0.1"
                            value={settings.payroll.deductions.pension.employerMatch}
                            onChange={(e) => updatePayrollSettings({
                              deductions: {
                                ...settings.payroll.deductions,
                                pension: {
                                  ...settings.payroll.deductions.pension,
                                  employerMatch: Number(e.target.value)
                                }
                              }
                            })}
                            placeholder="3"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Other Deductions */}
                <Card className="p-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Other Deductions</h4>
                        <p className="text-sm text-gray-600">Configure custom deduction items</p>
                      </div>
                      <Switch
                        checked={settings.payroll.deductions.other.enabled}
                        onCheckedChange={(checked) => updatePayrollSettings({
                          deductions: {
                            ...settings.payroll.deductions,
                            other: {
                              ...settings.payroll.deductions.other,
                              enabled: checked
                            }
                          }
                        })}
                      />
                    </div>
                    
                    {settings.payroll.deductions.other.enabled && (
                      <div className="space-y-4">
                        {settings.payroll.deductions.other.items.map((item, index) => (
                          <Card key={index} className="p-3 bg-gray-50">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                              <div>
                                <Label>Name</Label>
                                <Input
                                  value={item.name}
                                  onChange={(e) => {
                                    const newItems = [...settings.payroll.deductions.other.items]
                                    newItems[index] = { ...item, name: e.target.value }
                                    updatePayrollSettings({
                                      deductions: {
                                        ...settings.payroll.deductions,
                                        other: {
                                          ...settings.payroll.deductions.other,
                                          items: newItems
                                        }
                                      }
                                    })
                                  }}
                                  placeholder="Deduction name"
                                />
                              </div>
                              <div>
                                <Label>Rate (%)</Label>
                                <Input
                                  type="number"
                                  step="0.1"
                                  value={item.rate}
                                  onChange={(e) => {
                                    const newItems = [...settings.payroll.deductions.other.items]
                                    newItems[index] = { ...item, rate: Number(e.target.value) }
                                    updatePayrollSettings({
                                      deductions: {
                                        ...settings.payroll.deductions,
                                        other: {
                                          ...settings.payroll.deductions.other,
                                          items: newItems
                                        }
                                      }
                                    })
                                  }}
                                  placeholder="5"
                                />
                              </div>
                              <div>
                                <Label>Description</Label>
                                <Input
                                  value={item.description}
                                  onChange={(e) => {
                                    const newItems = [...settings.payroll.deductions.other.items]
                                    newItems[index] = { ...item, description: e.target.value }
                                    updatePayrollSettings({
                                      deductions: {
                                        ...settings.payroll.deductions,
                                        other: {
                                          ...settings.payroll.deductions.other,
                                          items: newItems
                                        }
                                      }
                                    })
                                  }}
                                  placeholder="Description"
                                />
                              </div>
                              <div className="flex justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const newItems = settings.payroll.deductions.other.items.filter((_, i) => i !== index)
                                    updatePayrollSettings({
                                      deductions: {
                                        ...settings.payroll.deductions,
                                        other: {
                                          ...settings.payroll.deductions.other,
                                          items: newItems
                                        }
                                      }
                                    })
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))}
                        <Button
                          variant="outline"
                          onClick={() => {
                            const newItem = { name: '', rate: 0, description: '' }
                            updatePayrollSettings({
                              deductions: {
                                ...settings.payroll.deductions,
                                other: {
                                  ...settings.payroll.deductions.other,
                                  items: [...settings.payroll.deductions.other.items, newItem]
                                }
                              }
                            })
                          }}
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Custom Deduction
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="mr-2 h-5 w-5" />
                Payment Facilitator Settings
              </CardTitle>
              <CardDescription>
                Configure payment providers for payroll processing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Active Provider Selection */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Active Payment Provider</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {(['paystack', 'thunes', 'flutterwave', 'hubtel'] as const).map((provider) => (
                    <Card 
                      key={provider}
                      className={`cursor-pointer transition-all ${
                        settings.paymentFacilitator.activeProvider === provider 
                          ? 'ring-2 ring-primary bg-primary/5' 
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => updatePaymentFacilitatorSettings({ activeProvider: provider })}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium capitalize">{provider}</h4>
                            <p className="text-sm text-gray-600">
                              {provider === 'paystack' && 'Nigerian & Ghanaian payments'}
                              {provider === 'thunes' && 'Global money transfers'}
                              {provider === 'flutterwave' && 'African payments'}
                              {provider === 'hubtel' && 'Ghanaian payments'}
                            </p>
                          </div>
                          {settings.paymentFacilitator.activeProvider === provider && (
                            <Check className="h-5 w-5 text-primary" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Paystack Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Paystack Configuration</span>
                    <Switch
                      checked={settings.paymentFacilitator.providers.paystack.enabled}
                      onCheckedChange={(checked) => updatePaymentProvider('paystack', { enabled: checked })}
                    />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="paystack-secret">Secret Key</Label>
                      <Input
                        id="paystack-secret"
                        type="password"
                        value={settings.paymentFacilitator.providers.paystack.credentials.secretKey}
                        onChange={(e) => updatePaymentProvider('paystack', {
                          credentials: {
                            ...settings.paymentFacilitator.providers.paystack.credentials,
                            secretKey: e.target.value
                          }
                        })}
                        placeholder="sk_live_..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="paystack-public">Public Key</Label>
                      <Input
                        id="paystack-public"
                        value={settings.paymentFacilitator.providers.paystack.credentials.publicKey}
                        onChange={(e) => updatePaymentProvider('paystack', {
                          credentials: {
                            ...settings.paymentFacilitator.providers.paystack.credentials,
                            publicKey: e.target.value
                          }
                        })}
                        placeholder="pk_live_..."
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Default Currency</Label>
                      <select
                        value={settings.paymentFacilitator.providers.paystack.settings.defaultCurrency}
                        onChange={(e) => updatePaymentProvider('paystack', {
                          settings: {
                            ...settings.paymentFacilitator.providers.paystack.settings,
                            defaultCurrency: e.target.value as 'NGN' | 'GHS' | 'USD' | 'ZAR'
                          }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="NGN">Nigerian Naira (NGN)</option>
                        <option value="GHS">Ghanaian Cedi (GHS)</option>
                        <option value="USD">US Dollar (USD)</option>
                        <option value="ZAR">South African Rand (ZAR)</option>
                      </select>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={settings.paymentFacilitator.providers.paystack.settings.testMode}
                        onCheckedChange={(checked) => updatePaymentProvider('paystack', {
                          settings: {
                            ...settings.paymentFacilitator.providers.paystack.settings,
                            testMode: checked
                          }
                        })}
                      />
                      <Label>Test Mode</Label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Thunes Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Thunes Configuration</span>
                    <Switch
                      checked={settings.paymentFacilitator.providers.thunes.enabled}
                      onCheckedChange={(checked) => updatePaymentProvider('thunes', { enabled: checked })}
                    />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="thunes-api">API Key</Label>
                      <Input
                        id="thunes-api"
                        type="password"
                        value={settings.paymentFacilitator.providers.thunes.credentials.apiKey}
                        onChange={(e) => updatePaymentProvider('thunes', {
                          credentials: {
                            ...settings.paymentFacilitator.providers.thunes.credentials,
                            apiKey: e.target.value
                          }
                        })}
                        placeholder="API Key"
                      />
                    </div>
                    <div>
                      <Label htmlFor="thunes-secret">Secret Key</Label>
                      <Input
                        id="thunes-secret"
                        type="password"
                        value={settings.paymentFacilitator.providers.thunes.credentials.secretKey}
                        onChange={(e) => updatePaymentProvider('thunes', {
                          credentials: {
                            ...settings.paymentFacilitator.providers.thunes.credentials,
                            secretKey: e.target.value
                          }
                        })}
                        placeholder="Secret Key"
                      />
                    </div>
                    <div>
                      <Label htmlFor="thunes-client">Client ID</Label>
                      <Input
                        id="thunes-client"
                        value={settings.paymentFacilitator.providers.thunes.credentials.clientId}
                        onChange={(e) => updatePaymentProvider('thunes', {
                          credentials: {
                            ...settings.paymentFacilitator.providers.thunes.credentials,
                            clientId: e.target.value
                          }
                        })}
                        placeholder="Client ID"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Region</Label>
                      <select
                        value={settings.paymentFacilitator.providers.thunes.settings.region}
                        onChange={(e) => updatePaymentProvider('thunes', {
                          settings: {
                            ...settings.paymentFacilitator.providers.thunes.settings,
                            region: e.target.value as 'global' | 'africa' | 'asia' | 'europe' | 'americas'
                          }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="global">Global</option>
                        <option value="africa">Africa</option>
                        <option value="asia">Asia</option>
                        <option value="europe">Europe</option>
                        <option value="americas">Americas</option>
                      </select>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={settings.paymentFacilitator.providers.thunes.settings.testMode}
                        onCheckedChange={(checked) => updatePaymentProvider('thunes', {
                          settings: {
                            ...settings.paymentFacilitator.providers.thunes.settings,
                            testMode: checked
                          }
                        })}
                      />
                      <Label>Test Mode</Label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Flutterwave Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Flutterwave Configuration</span>
                    <Switch
                      checked={settings.paymentFacilitator.providers.flutterwave.enabled}
                      onCheckedChange={(checked) => updatePaymentProvider('flutterwave', { enabled: checked })}
                    />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="flutterwave-secret">Secret Key</Label>
                      <Input
                        id="flutterwave-secret"
                        type="password"
                        value={settings.paymentFacilitator.providers.flutterwave.credentials.secretKey}
                        onChange={(e) => updatePaymentProvider('flutterwave', {
                          credentials: {
                            ...settings.paymentFacilitator.providers.flutterwave.credentials,
                            secretKey: e.target.value
                          }
                        })}
                        placeholder="FLWSECK-..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="flutterwave-public">Public Key</Label>
                      <Input
                        id="flutterwave-public"
                        value={settings.paymentFacilitator.providers.flutterwave.credentials.publicKey}
                        onChange={(e) => updatePaymentProvider('flutterwave', {
                          credentials: {
                            ...settings.paymentFacilitator.providers.flutterwave.credentials,
                            publicKey: e.target.value
                          }
                        })}
                        placeholder="FLWPUBK-..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="flutterwave-encryption">Encryption Key</Label>
                      <Input
                        id="flutterwave-encryption"
                        type="password"
                        value={settings.paymentFacilitator.providers.flutterwave.credentials.encryptionKey}
                        onChange={(e) => updatePaymentProvider('flutterwave', {
                          credentials: {
                            ...settings.paymentFacilitator.providers.flutterwave.credentials,
                            encryptionKey: e.target.value
                          }
                        })}
                        placeholder="FLWSECK_TEST-..."
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={settings.paymentFacilitator.providers.flutterwave.settings.testMode}
                      onCheckedChange={(checked) => updatePaymentProvider('flutterwave', {
                        settings: {
                          ...settings.paymentFacilitator.providers.flutterwave.settings,
                          testMode: checked
                        }
                      })}
                    />
                    <Label>Test Mode</Label>
                  </div>
                </CardContent>
              </Card>

              {/* Hubtel Configuration */}
              {settings.paymentFacilitator.providers.hubtel && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Hubtel Configuration</span>
                      <Switch
                        checked={settings.paymentFacilitator.providers.hubtel.enabled}
                        onCheckedChange={(checked) => updatePaymentProvider('hubtel', { enabled: checked })}
                      />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="hubtel-client">Client ID</Label>
                        <Input
                          id="hubtel-client"
                          type="text"
                          value={settings.paymentFacilitator.providers.hubtel.credentials.clientId}
                          onChange={(e) => updatePaymentProvider('hubtel', {
                            credentials: {
                              ...settings.paymentFacilitator.providers.hubtel.credentials,
                              clientId: e.target.value
                            }
                          })}
                          placeholder="HM..."
                        />
                      </div>
                      <div>
                        <Label htmlFor="hubtel-secret">Client Secret</Label>
                        <Input
                          id="hubtel-secret"
                          type="password"
                          value={settings.paymentFacilitator.providers.hubtel.credentials.clientSecret}
                          onChange={(e) => updatePaymentProvider('hubtel', {
                            credentials: {
                              ...settings.paymentFacilitator.providers.hubtel.credentials,
                              clientSecret: e.target.value
                            }
                          })}
                          placeholder="Client Secret"
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={settings.paymentFacilitator.providers.hubtel.settings.testMode}
                        onCheckedChange={(checked) => updatePaymentProvider('hubtel', {
                          settings: {
                            ...settings.paymentFacilitator.providers.hubtel.settings,
                            testMode: checked
                          }
                        })}
                      />
                      <Label>Test Mode</Label>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Default Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Default Payment Settings</CardTitle>
                  <CardDescription>
                    Configure default settings for all payment providers
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="default-currency">Default Currency</Label>
                      <Input
                        id="default-currency"
                        value={settings.paymentFacilitator.defaultSettings.currency}
                        onChange={(e) => updatePaymentFacilitatorSettings({
                          defaultSettings: {
                            ...settings.paymentFacilitator.defaultSettings,
                            currency: e.target.value
                          }
                        })}
                        placeholder="USD"
                      />
                    </div>
                    <div>
                      <Label htmlFor="retry-attempts">Retry Attempts</Label>
                      <Input
                        id="retry-attempts"
                        type="number"
                        value={settings.paymentFacilitator.defaultSettings.retryAttempts}
                        onChange={(e) => updatePaymentFacilitatorSettings({
                          defaultSettings: {
                            ...settings.paymentFacilitator.defaultSettings,
                            retryAttempts: Number(e.target.value)
                          }
                        })}
                        placeholder="3"
                      />
                    </div>
                    <div>
                      <Label htmlFor="timeout">Timeout (seconds)</Label>
                      <Input
                        id="timeout"
                        type="number"
                        value={settings.paymentFacilitator.defaultSettings.timeoutSeconds}
                        onChange={(e) => updatePaymentFacilitatorSettings({
                          defaultSettings: {
                            ...settings.paymentFacilitator.defaultSettings,
                            timeoutSeconds: Number(e.target.value)
                          }
                        })}
                        placeholder="30"
                      />
                    </div>
                    <div>
                      <Label htmlFor="batch-size">Batch Size</Label>
                      <Input
                        id="batch-size"
                        type="number"
                        value={settings.paymentFacilitator.defaultSettings.batchSize}
                        onChange={(e) => updatePaymentFacilitatorSettings({
                          defaultSettings: {
                            ...settings.paymentFacilitator.defaultSettings,
                            batchSize: Number(e.target.value)
                          }
                        })}
                        placeholder="50"
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={settings.paymentFacilitator.defaultSettings.enableNotifications}
                      onCheckedChange={(checked) => updatePaymentFacilitatorSettings({
                        defaultSettings: {
                          ...settings.paymentFacilitator.defaultSettings,
                          enableNotifications: checked
                        }
                      })}
                    />
                    <Label>Enable Payment Notifications</Label>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="company" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>
                Configure company details and working hours
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={settings.company.name}
                    onChange={(e) => setSettings({
                      ...settings,
                      company: { ...settings.company, name: e.target.value }
                    })}
                    placeholder="Your Company"
                  />
                </div>
                <div>
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input
                    id="timezone"
                    value={settings.company.timezone}
                    onChange={(e) => setSettings({
                      ...settings,
                      company: { ...settings.company, timezone: e.target.value }
                    })}
                    placeholder="UTC"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="workStart">Work Start Time</Label>
                  <Input
                    id="workStart"
                    type="time"
                    value={settings.company.workingHours.start}
                    onChange={(e) => setSettings({
                      ...settings,
                      company: {
                        ...settings.company,
                        workingHours: { ...settings.company.workingHours, start: e.target.value }
                      }
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="workEnd">Work End Time</Label>
                  <Input
                    id="workEnd"
                    type="time"
                    value={settings.company.workingHours.end}
                    onChange={(e) => setSettings({
                      ...settings,
                      company: {
                        ...settings.company,
                        workingHours: { ...settings.company.workingHours, end: e.target.value }
                      }
                    })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="mr-2 h-5 w-5" />
                Attendance Settings
              </CardTitle>
              <CardDescription>
                Configure attendance tracking parameters and policies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Working Hours */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Working Hours</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="checkInTime">Check-in Time</Label>
                    <Input
                      id="checkInTime"
                      type="time"
                      value={settings.attendance.checkInTime}
                      onChange={(e) => updateAttendanceSettings({ checkInTime: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="checkOutTime">Check-out Time</Label>
                    <Input
                      id="checkOutTime"
                      type="time"
                      value={settings.attendance.checkOutTime}
                      onChange={(e) => updateAttendanceSettings({ checkOutTime: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Thresholds */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Thresholds</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="lateThreshold">Late Threshold (minutes)</Label>
                    <Input
                      id="lateThreshold"
                      type="number"
                      value={settings.attendance.lateThreshold}
                      onChange={(e) => updateAttendanceSettings({ lateThreshold: Number(e.target.value) })}
                      placeholder="15"
                    />
                  </div>
                  <div>
                    <Label htmlFor="earlyLeaveThreshold">Early Leave Threshold (minutes)</Label>
                    <Input
                      id="earlyLeaveThreshold"
                      type="number"
                      value={settings.attendance.earlyLeaveThreshold}
                      onChange={(e) => updateAttendanceSettings({ earlyLeaveThreshold: Number(e.target.value) })}
                      placeholder="30"
                    />
                  </div>
                  <div>
                    <Label htmlFor="overtimeThreshold">Overtime Threshold (hours)</Label>
                    <Input
                      id="overtimeThreshold"
                      type="number"
                      value={settings.attendance.overtimeThreshold}
                      onChange={(e) => updateAttendanceSettings({ overtimeThreshold: Number(e.target.value) })}
                      placeholder="8"
                    />
                  </div>
                  <div>
                    <Label htmlFor="idleTimeSLAThreshold">Idle Time SLA Threshold (minutes)</Label>
                    <Input
                      id="idleTimeSLAThreshold"
                      type="number"
                      value={settings.attendance.idleTimeSLAThreshold || 3}
                      onChange={(e) => updateAttendanceSettings({ idleTimeSLAThreshold: Number(e.target.value) })}
                      placeholder="3"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Idle time exceeding this threshold will trigger SLA warnings
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Location Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium flex items-center">
                  <MapPin className="mr-2 h-5 w-5" />
                  Location Settings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={settings.attendance.geolocationRequired}
                      onCheckedChange={(checked) => updateAttendanceSettings({ geolocationRequired: checked })}
                    />
                    <Label>Require Geolocation</Label>
                  </div>
                  <div>
                    <Label htmlFor="maxDistance">Max Distance (meters)</Label>
                    <Input
                      id="maxDistance"
                      type="number"
                      value={settings.attendance.maxDistance}
                      onChange={(e) => updateAttendanceSettings({ maxDistance: Number(e.target.value) })}
                      placeholder="100"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="productivity" className="space-y-6">
          <ToolsPolicySettings />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="mr-2 h-5 w-5" />
                Productivity Settings
              </CardTitle>
              <CardDescription>
                Configure productivity tracking and focus session parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium flex items-center">
                  <Target className="mr-2 h-5 w-5" />
                  Basic Settings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={settings.productivity.trackingEnabled}
                      onCheckedChange={(checked) => updateProductivitySettings({ trackingEnabled: checked })}
                    />
                    <Label>Enable Productivity Tracking</Label>
                  </div>
                  <div>
                    <Label htmlFor="idleThreshold">Idle Threshold (minutes)</Label>
                    <Input
                      id="idleThreshold"
                      type="number"
                      value={settings.productivity.idleThreshold}
                      onChange={(e) => updateProductivitySettings({ idleThreshold: Number(e.target.value) })}
                      placeholder="15"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Focus Sessions */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Focus Session Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="focusSessionDuration">Focus Session Duration (minutes)</Label>
                    <Input
                      id="focusSessionDuration"
                      type="number"
                      value={settings.productivity.focusSessionDuration}
                      onChange={(e) => updateProductivitySettings({ focusSessionDuration: Number(e.target.value) })}
                      placeholder="25"
                    />
                  </div>
                  <div>
                    <Label htmlFor="targetProductiveHours">Target Productive Hours</Label>
                    <Input
                      id="targetProductiveHours"
                      type="number"
                      value={settings.productivity.targetProductiveHours}
                      onChange={(e) => updateProductivitySettings({ targetProductiveHours: Number(e.target.value) })}
                      placeholder="6"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Domain Lists */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Domain Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="productiveDomains">Productive Domains (comma-separated)</Label>
                    <Input
                      id="productiveDomains"
                      value={settings.productivity.productiveDomains.join(', ')}
                      onChange={(e) => updateProductivitySettings({ 
                        productiveDomains: e.target.value.split(',').map(d => d.trim()).filter(d => d)
                      })}
                      placeholder="github.com, stackoverflow.com, docs.google.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="unproductiveSites">Unproductive Sites (comma-separated)</Label>
                    <Input
                      id="unproductiveSites"
                      value={settings.productivity.unproductiveSites.join(', ')}
                      onChange={(e) => updateProductivitySettings({ 
                        unproductiveSites: e.target.value.split(',').map(d => d.trim()).filter(d => d)
                      })}
                      placeholder="facebook.com, twitter.com, youtube.com"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bell className="mr-2 h-5 w-5" />
                Notification Settings
              </CardTitle>
              <CardDescription>
                Configure notification preferences and alerts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Email Notifications */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Email Notifications</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={settings.notifications.email.enabled}
                      onCheckedChange={(checked) => updateNotificationSettings({
                        email: { ...settings.notifications.email, enabled: checked }
                      })}
                    />
                    <Label>Enable Email Notifications</Label>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="emailFrom">From Email</Label>
                      <Input
                        id="emailFrom"
                        type="email"
                        value={settings.notifications.email.from}
                        onChange={(e) => updateNotificationSettings({
                          email: { ...settings.notifications.email, from: e.target.value }
                        })}
                        placeholder="noreply@yourdomain.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="emailReplyTo">Reply To</Label>
                      <Input
                        id="emailReplyTo"
                        type="email"
                        value={settings.notifications.email.replyTo}
                        onChange={(e) => updateNotificationSettings({
                          email: { ...settings.notifications.email, replyTo: e.target.value }
                        })}
                        placeholder="hr@yourdomain.com"
                      />
                    </div>
                  </div>
                  
                  {/* SMTP Configuration */}
                  <div className="mt-4 space-y-4 p-4 bg-gray-50 rounded-lg border">
                    <h4 className="text-sm font-medium text-gray-900">SMTP Server Configuration</h4>
                    <p className="text-xs text-gray-600 mb-4">
                      Configure your SMTP server settings to send emails. For Hostinger Titan Mail, use the settings provided in the documentation.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="smtpHost">SMTP Host</Label>
                        <Input
                          id="smtpHost"
                          value={settings.notifications.email.smtp.host}
                          onChange={(e) => updateNotificationSettings({
                            email: { 
                              ...settings.notifications.email, 
                              smtp: { ...settings.notifications.email.smtp, host: e.target.value }
                            }
                          })}
                          placeholder="smtp.titan.email"
                        />
                      </div>
                      <div>
                        <Label htmlFor="smtpPort">SMTP Port</Label>
                        <Input
                          id="smtpPort"
                          type="number"
                          value={settings.notifications.email.smtp.port}
                          onChange={(e) => updateNotificationSettings({
                            email: { 
                              ...settings.notifications.email, 
                              smtp: { ...settings.notifications.email.smtp, port: Number(e.target.value) }
                            }
                          })}
                          placeholder="587"
                        />
                      </div>
                      <div>
                        <Label htmlFor="smtpUsername">SMTP Username</Label>
                        <Input
                          id="smtpUsername"
                          type="email"
                          value={settings.notifications.email.smtp.username}
                          onChange={(e) => updateNotificationSettings({
                            email: { 
                              ...settings.notifications.email, 
                              smtp: { ...settings.notifications.email.smtp, username: e.target.value }
                            }
                          })}
                          placeholder="your-email@yourdomain.com"
                        />
                      </div>
                      <div>
                        <Label htmlFor="smtpPassword">SMTP Password</Label>
                        <Input
                          id="smtpPassword"
                          type="password"
                          value={settings.notifications.email.smtp.password}
                          onChange={(e) => updateNotificationSettings({
                            email: { 
                              ...settings.notifications.email, 
                              smtp: { ...settings.notifications.email.smtp, password: e.target.value }
                            }
                          })}
                          placeholder="Your SMTP password"
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="smtpSecure"
                        checked={settings.notifications.email.smtp.secure}
                        onCheckedChange={(checked) => updateNotificationSettings({
                          email: { 
                            ...settings.notifications.email, 
                            smtp: { ...settings.notifications.email.smtp, secure: checked }
                          }
                        })}
                      />
                      <Label htmlFor="smtpSecure" className="text-sm font-normal">
                        Use SSL/TLS (Enable for port 465, disable for port 587 with STARTTLS)
                      </Label>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* SMS Notifications */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">SMS Notifications</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={settings.notifications.sms.enabled}
                      onCheckedChange={(checked) => updateNotificationSettings({
                        sms: { ...settings.notifications.sms, enabled: checked }
                      })}
                    />
                    <Label>Enable SMS Notifications</Label>
                  </div>
                  <div>
                    <Label htmlFor="smsProvider">SMS Provider</Label>
                    <Input
                      id="smsProvider"
                      value={settings.notifications.sms.provider}
                      onChange={(e) => updateNotificationSettings({
                        sms: { ...settings.notifications.sms, provider: e.target.value }
                      })}
                      placeholder="Twilio"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Push Notifications */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Push Notifications</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={settings.notifications.push.enabled}
                      onCheckedChange={(checked) => updateNotificationSettings({
                        push: { ...settings.notifications.push, enabled: checked }
                      })}
                    />
                    <Label>Enable Push Notifications</Label>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="vapidPublicKey">VAPID Public Key</Label>
                      <Input
                        id="vapidPublicKey"
                        value={settings.notifications.push.vapidPublicKey}
                        onChange={(e) => updateNotificationSettings({
                          push: { ...settings.notifications.push, vapidPublicKey: e.target.value }
                        })}
                        placeholder="Public key for push notifications"
                      />
                    </div>
                    <div>
                      <Label htmlFor="vapidPrivateKey">VAPID Private Key</Label>
                      <Input
                        id="vapidPrivateKey"
                        type="password"
                        value={settings.notifications.push.vapidPrivateKey}
                        onChange={(e) => updateNotificationSettings({
                          push: { ...settings.notifications.push, vapidPrivateKey: e.target.value }
                        })}
                        placeholder="Private key for push notifications"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Notification Maintenance */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Maintenance</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Clean Up Invalid Notifications</Label>
                      <p className="text-sm text-gray-600">Remove notifications with invalid data from the database</p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleCleanupNotifications}
                      disabled={saving}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Clean Up
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="mr-2 h-5 w-5" />
                Security Settings
              </CardTitle>
              <CardDescription>
                Configure security policies and access controls
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Password Policy */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Password Policy</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="minPasswordLength">Minimum Length</Label>
                    <Input
                      id="minPasswordLength"
                      type="number"
                      value={settings.security.passwordPolicy.minLength}
                      onChange={(e) => updateSecuritySettings({
                        passwordPolicy: { ...settings.security.passwordPolicy, minLength: Number(e.target.value) }
                      })}
                      placeholder="8"
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxPasswordAge">Max Age (days)</Label>
                    <Input
                      id="maxPasswordAge"
                      type="number"
                      value={settings.security.passwordPolicy.maxAge}
                      onChange={(e) => updateSecuritySettings({
                        passwordPolicy: { ...settings.security.passwordPolicy, maxAge: Number(e.target.value) }
                      })}
                      placeholder="90"
                    />
                  </div>
                  <div>
                    <Label htmlFor="passwordHistory">Password History</Label>
                    <Input
                      id="passwordHistory"
                      type="number"
                      value={settings.security.passwordPolicy.historyCount}
                      onChange={(e) => updateSecuritySettings({
                        passwordPolicy: { ...settings.security.passwordPolicy, historyCount: Number(e.target.value) }
                      })}
                      placeholder="5"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={settings.security.passwordPolicy.requireUppercase}
                      onCheckedChange={(checked) => updateSecuritySettings({
                        passwordPolicy: { ...settings.security.passwordPolicy, requireUppercase: checked }
                      })}
                    />
                    <Label>Require Uppercase</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={settings.security.passwordPolicy.requireLowercase}
                      onCheckedChange={(checked) => updateSecuritySettings({
                        passwordPolicy: { ...settings.security.passwordPolicy, requireLowercase: checked }
                      })}
                    />
                    <Label>Require Lowercase</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={settings.security.passwordPolicy.requireNumbers}
                      onCheckedChange={(checked) => updateSecuritySettings({
                        passwordPolicy: { ...settings.security.passwordPolicy, requireNumbers: checked }
                      })}
                    />
                    <Label>Require Numbers</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={settings.security.passwordPolicy.requireSpecialChars}
                      onCheckedChange={(checked) => updateSecuritySettings({
                        passwordPolicy: { ...settings.security.passwordPolicy, requireSpecialChars: checked }
                      })}
                    />
                    <Label>Require Special Characters</Label>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Session Management */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Session Management</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
                    <Input
                      id="sessionTimeout"
                      type="number"
                      value={settings.security.sessionManagement.timeout}
                      onChange={(e) => updateSecuritySettings({
                        sessionManagement: { ...settings.security.sessionManagement, timeout: Number(e.target.value) }
                      })}
                      placeholder="30"
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxConcurrentSessions">Max Concurrent Sessions</Label>
                    <Input
                      id="maxConcurrentSessions"
                      type="number"
                      value={settings.security.sessionManagement.maxConcurrent}
                      onChange={(e) => updateSecuritySettings({
                        sessionManagement: { ...settings.security.sessionManagement, maxConcurrent: Number(e.target.value) }
                      })}
                      placeholder="3"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Two-Factor Authentication */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Two-Factor Authentication</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={settings.security.twoFactor.enabled}
                      onCheckedChange={(checked) => updateSecuritySettings({
                        twoFactor: { ...settings.security.twoFactor, enabled: checked }
                      })}
                    />
                    <Label>Enable 2FA</Label>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="twoFactorMethod">Default Method</Label>
                      <Input
                        id="twoFactorMethod"
                        value={settings.security.twoFactor.defaultMethod}
                        onChange={(e) => updateSecuritySettings({
                          twoFactor: { ...settings.security.twoFactor, defaultMethod: e.target.value }
                        })}
                        placeholder="TOTP"
                      />
                    </div>
                    <div>
                      <Label htmlFor="backupCodes">Backup Codes Count</Label>
                      <Input
                        id="backupCodes"
                        type="number"
                        value={settings.security.twoFactor.backupCodesCount}
                        onChange={(e) => updateSecuritySettings({
                          twoFactor: { ...settings.security.twoFactor, backupCodesCount: Number(e.target.value) }
                        })}
                        placeholder="10"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Import Settings */}
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Import/Export Settings</CardTitle>
            <CardDescription>
              Backup or restore your settings configuration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <Button variant="outline" onClick={exportSettings}>
                <Download className="h-4 w-4 mr-2" />
                Export Settings
              </Button>
              <div>
                <input
                  type="file"
                  accept=".json"
                  onChange={importSettings}
                  className="hidden"
                  id="import-settings"
                />
                <Label htmlFor="import-settings" className="cursor-pointer">
                  <Button variant="outline" asChild>
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      Import Settings
                    </span>
                  </Button>
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 