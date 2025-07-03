'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { SettingsService } from '@/lib/settings'
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
  AlertCircle
} from 'lucide-react'
import { toast } from '@/components/ui/use-toast'

export default function SettingsPage() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const currentSettings = await SettingsService.getInstance().getSettings()
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
      await SettingsService.getInstance().updateSettings(settings)
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
      await SettingsService.getInstance().resetToDefaults()
      await loadSettings()
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
      const settingsJson = await SettingsService.getInstance().exportSettings()
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
      await SettingsService.getInstance().importSettings(text)
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
          <p className="text-gray-600 mt-2">
            Configure system-wide settings and bonus structures
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={exportSettings}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" onClick={resetToDefaults}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button onClick={saveSettings} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="payroll" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="payroll" className="flex items-center space-x-2">
            <DollarSign className="h-4 w-4" />
            <span>Payroll</span>
          </TabsTrigger>
          <TabsTrigger value="company" className="flex items-center space-x-2">
            <Users className="h-4 w-4" />
            <span>Company</span>
          </TabsTrigger>
          <TabsTrigger value="attendance" className="flex items-center space-x-2">
            <Clock className="h-4 w-4" />
            <span>Attendance</span>
          </TabsTrigger>
          <TabsTrigger value="productivity" className="flex items-center space-x-2">
            <TrendingUp className="h-4 w-4" />
            <span>Productivity</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center space-x-2">
            <Bell className="h-4 w-4" />
            <span>Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center space-x-2">
            <Shield className="h-4 w-4" />
            <span>Security</span>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <div>
                  <Label htmlFor="insuranceRate">Default Insurance Rate (%)</Label>
                  <Input
                    id="insuranceRate"
                    type="number"
                    value={settings.payroll.insuranceRate}
                    onChange={(e) => updatePayrollSettings({ insuranceRate: Number(e.target.value) })}
                    placeholder="10"
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
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
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
                          <div className="flex items-center space-x-2">
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
                        placeholder="noreply@company.com"
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
                        placeholder="hr@company.com"
                      />
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