'use client'

import { useState, useEffect } from 'react'
import { db } from "@/lib/firebase"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { toast } from "react-hot-toast"
import { AttendanceSettings, SystemSettings, PayrollSettings, LocationSettings } from "@/types/settings"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { OfficeLocationsManager } from '@/components/office-locations-manager'
import { countries } from '@/lib/countries'

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
  allowedCountries: ['GH'], // Default to Ghana
  defaultCountry: 'GH',
  requireLocationValidation: true,
  allowRemoteWork: false,
  officeLocations: [],
  locationValidationRules: {
    requireExactLocation: true,
    allowApproximateLocation: false,
    minimumAccuracy: 100, // meters
    validateOnCheckIn: true,
    validateOnCheckOut: true
  }
}

type SettingsValue = string | number | boolean | string[] | { start: string; end: string }
type SettingsObject = Record<string, SettingsValue>

function flattenObject(obj: SettingsObject, prefix = ''): Record<string, SettingsValue> {
  return Object.keys(obj).reduce((acc: Record<string, SettingsValue>, k: string) => {
    const pre = prefix.length ? prefix + '.' : '';
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      Object.assign(acc, flattenObject(obj[k] as SettingsObject, pre + k));
    } else {
      acc[pre + k] = obj[k];
    }
    return acc;
  }, {});
}

interface SettingsData {
  attendance?: Partial<AttendanceSettings>;
  system?: Partial<SystemSettings>;
  payroll?: Partial<PayrollSettings>;
  location?: Partial<LocationSettings>;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("attendance")
  const [attendanceSettings, setAttendanceSettings] = useState<AttendanceSettings>(DEFAULT_ATTENDANCE_SETTINGS)
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS)
  const [payrollSettings, setPayrollSettings] = useState<PayrollSettings>(DEFAULT_PAYROLL_SETTINGS)
  const [locationSettings, setLocationSettings] = useState<LocationSettings>(DEFAULT_LOCATION_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, "settings", "company"))
        if (settingsDoc.exists()) {
          const data = settingsDoc.data() as SettingsData
          setAttendanceSettings({
            ...DEFAULT_ATTENDANCE_SETTINGS,
            ...data.attendance,
            workingHours: {
              ...DEFAULT_ATTENDANCE_SETTINGS.workingHours,
              ...data.attendance?.workingHours
            }
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
      } catch (error) {
        console.error("Error fetching settings:", error)
        toast.error("Failed to load settings")
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const settingsRef = doc(db, "settings", "company")
      const flattenedAttendance = flattenObject(attendanceSettings as unknown as SettingsObject)
      const flattenedSystem = flattenObject(systemSettings as unknown as SettingsObject)
      const flattenedPayroll = flattenObject(payrollSettings as unknown as SettingsObject)
      const flattenedLocation = flattenObject(locationSettings as unknown as SettingsObject)

      await setDoc(settingsRef, {
        attendance: flattenedAttendance,
        system: flattenedSystem,
        payroll: flattenedPayroll,
        location: flattenedLocation
      }, { merge: true })

      toast.success("Settings saved successfully")
    } catch (error) {
      console.error("Error saving settings:", error)
      toast.error("Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  const handleAttendanceChange = (key: keyof AttendanceSettings, value: AttendanceSettings[keyof AttendanceSettings]) => {
    setAttendanceSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleSystemChange = (key: keyof SystemSettings, value: SystemSettings[keyof SystemSettings]) => {
    setSystemSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleCheckInDaysChange = (day: string, checked: boolean) => {
    setAttendanceSettings(prev => ({
      ...prev,
      requiredCheckInDays: checked
        ? [...prev.requiredCheckInDays, day]
        : prev.requiredCheckInDays.filter(d => d !== day)
    }))
  }

  const handleLocationChange = (key: keyof LocationSettings, value: LocationSettings[keyof LocationSettings]) => {
    setLocationSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleAllowedCountriesChange = (countryCode: string, checked: boolean) => {
    setLocationSettings(prev => ({
      ...prev,
      allowedCountries: checked
        ? [...prev.allowedCountries, countryCode]
        : prev.allowedCountries.filter(code => code !== countryCode)
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="location">Location</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="mt-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Working Hours</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Input
                      type="time"
                      value={attendanceSettings.workingHours?.start || DEFAULT_ATTENDANCE_SETTINGS.workingHours.start}
                      onChange={(e) => handleAttendanceChange('workingHours', {
                        ...attendanceSettings.workingHours,
                        start: e.target.value
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Input
                      type="time"
                      value={attendanceSettings.workingHours?.end || DEFAULT_ATTENDANCE_SETTINGS.workingHours.end}
                      onChange={(e) => handleAttendanceChange('workingHours', {
                        ...attendanceSettings.workingHours,
                        end: e.target.value
                      })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Attendance Rules</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Idle Threshold (minutes)</Label>
                    <Input
                      type="number"
                      value={attendanceSettings.idleThreshold}
                      onChange={(e) => handleAttendanceChange('idleThreshold', Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Idle Periods</Label>
                    <Input
                      type="number"
                      value={attendanceSettings.maxIdlePeriods}
                      onChange={(e) => handleAttendanceChange('maxIdlePeriods', Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Allowed Late Minutes</Label>
                    <Input
                      type="number"
                      value={attendanceSettings.allowedLateMinutes}
                      onChange={(e) => handleAttendanceChange('allowedLateMinutes', Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Location Radius (meters)</Label>
                    <Input
                      type="number"
                      value={attendanceSettings.locationRadius}
                      onChange={(e) => handleAttendanceChange('locationRadius', Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <Label>Required Check-in Days</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-4">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                      <div key={day} className="flex items-center space-x-2">
                        <Switch
                          checked={attendanceSettings.requiredCheckInDays.includes(day)}
                          onCheckedChange={(checked: boolean) => handleCheckInDaysChange(day, checked)}
                        />
                        <Label className="text-sm">{day.slice(0, 3)}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={attendanceSettings.requireManagerApproval}
                      onCheckedChange={(checked: boolean) => handleAttendanceChange('requireManagerApproval', checked)}
                    />
                    <Label>Require Manager Approval</Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Auto-approve Threshold (hours)</Label>
                  <Input
                    type="number"
                    value={attendanceSettings.autoApproveThreshold}
                    onChange={(e) => handleAttendanceChange('autoApproveThreshold', Number(e.target.value))}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="location">
          <Card>
            <CardHeader>
              <CardTitle>Location Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Default Country</Label>
                  <Select
                    value={locationSettings.defaultCountry}
                    onValueChange={(value) => handleLocationChange('defaultCountry', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select default country" />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((country) => (
                        <SelectItem key={country.code} value={country.code}>
                          {country.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Minimum Location Accuracy (meters)</Label>
                  <Input
                    type="number"
                    value={locationSettings.locationValidationRules.minimumAccuracy}
                    onChange={(e) => handleLocationChange('locationValidationRules', {
                      ...locationSettings.locationValidationRules,
                      minimumAccuracy: Number(e.target.value)
                    })}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={locationSettings.requireLocationValidation}
                    onCheckedChange={(checked) => handleLocationChange('requireLocationValidation', checked)}
                  />
                  <Label>Require Location Validation</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={locationSettings.allowRemoteWork}
                    onCheckedChange={(checked) => handleLocationChange('allowRemoteWork', checked)}
                  />
                  <Label>Allow Remote Work</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={locationSettings.locationValidationRules.requireExactLocation}
                    onCheckedChange={(checked) => handleLocationChange('locationValidationRules', {
                      ...locationSettings.locationValidationRules,
                      requireExactLocation: checked
                    })}
                  />
                  <Label>Require Exact Location</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={locationSettings.locationValidationRules.validateOnCheckIn}
                    onCheckedChange={(checked) => handleLocationChange('locationValidationRules', {
                      ...locationSettings.locationValidationRules,
                      validateOnCheckIn: checked
                    })}
                  />
                  <Label>Validate Location on Check-in</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={locationSettings.locationValidationRules.validateOnCheckOut}
                    onCheckedChange={(checked) => handleLocationChange('locationValidationRules', {
                      ...locationSettings.locationValidationRules,
                      validateOnCheckOut: checked
                    })}
                  />
                  <Label>Validate Location on Check-out</Label>
                </div>
              </div>

              <div className="space-y-4">
                <Label>Allowed Countries</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {countries.map((country) => (
                    <label key={country.code} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={locationSettings.allowedCountries.includes(country.code)}
                        onChange={(e) => handleAllowedCountriesChange(country.code, e.target.checked)}
                        className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{country.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <OfficeLocationsManager
                settings={locationSettings}
                onUpdate={setLocationSettings}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="mt-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Company Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input
                    value={systemSettings.companyName}
                    onChange={(e) => handleSystemChange('companyName', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Select
                      value={systemSettings.timezone}
                      onValueChange={(value) => handleSystemChange('timezone', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UTC">UTC</SelectItem>
                        <SelectItem value="EST">Eastern Time</SelectItem>
                        <SelectItem value="PST">Pacific Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Date Format</Label>
                    <Select
                      value={systemSettings.dateFormat}
                      onValueChange={(value) => handleSystemChange('dateFormat', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select date format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Language</Label>
                    <Select
                      value={systemSettings.language}
                      onValueChange={(value) => handleSystemChange('language', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={systemSettings.emailNotifications}
                      onCheckedChange={(checked: boolean) => handleSystemChange('emailNotifications', checked)}
                    />
                    <Label>Email Notifications</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={systemSettings.smsNotifications}
                      onCheckedChange={(checked: boolean) => handleSystemChange('smsNotifications', checked)}
                    />
                    <Label>SMS Notifications</Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="payroll">
          <Card>
            <CardHeader>
              <CardTitle>Payroll Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Currency Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Currency Settings</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Currency Code</Label>
                    <Input
                      value={payrollSettings.currency.code}
                      onChange={(e) => setPayrollSettings(prev => ({
                        ...prev,
                        currency: { ...prev.currency, code: e.target.value }
                      }))}
                    />
                  </div>
                  <div>
                    <Label>Currency Symbol</Label>
                    <Input
                      value={payrollSettings.currency.symbol}
                      onChange={(e) => setPayrollSettings(prev => ({
                        ...prev,
                        currency: { ...prev.currency, symbol: e.target.value }
                      }))}
                    />
                  </div>
                  <div>
                    <Label>Exchange Rate</Label>
                    <Input
                      type="number"
                      value={payrollSettings.currency.exchangeRate}
                      onChange={(e) => setPayrollSettings(prev => ({
                        ...prev,
                        currency: { ...prev.currency, exchangeRate: Number(e.target.value) }
                      }))}
                    />
                  </div>
                </div>
              </div>

              {/* Deductions Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Deductions</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Tax</Label>
                      <p className="text-sm text-gray-500">Enable and set tax percentage</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Switch
                        checked={payrollSettings.deductions.tax.enabled}
                        onCheckedChange={(checked) => setPayrollSettings(prev => ({
                          ...prev,
                          deductions: {
                            ...prev.deductions,
                            tax: { ...prev.deductions.tax, enabled: checked }
                          }
                        }))}
                      />
                      <Input
                        type="number"
                        value={payrollSettings.deductions.tax.percentage}
                        onChange={(e) => setPayrollSettings(prev => ({
                          ...prev,
                          deductions: {
                            ...prev.deductions,
                            tax: { ...prev.deductions.tax, percentage: Number(e.target.value) }
                          }
                        }))}
                        className="w-24"
                        disabled={!payrollSettings.deductions.tax.enabled}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Insurance</Label>
                      <p className="text-sm text-gray-500">Enable and set insurance percentage</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Switch
                        checked={payrollSettings.deductions.insurance.enabled}
                        onCheckedChange={(checked) => setPayrollSettings(prev => ({
                          ...prev,
                          deductions: {
                            ...prev.deductions,
                            insurance: { ...prev.deductions.insurance, enabled: checked }
                          }
                        }))}
                      />
                      <Input
                        type="number"
                        value={payrollSettings.deductions.insurance.percentage}
                        onChange={(e) => setPayrollSettings(prev => ({
                          ...prev,
                          deductions: {
                            ...prev.deductions,
                            insurance: { ...prev.deductions.insurance, percentage: Number(e.target.value) }
                          }
                        }))}
                        className="w-24"
                        disabled={!payrollSettings.deductions.insurance.enabled}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Other Deductions</Label>
                        <p className="text-sm text-gray-500">Enable and add custom deductions</p>
                      </div>
                      <Switch
                        checked={payrollSettings.deductions.other.enabled}
                        onCheckedChange={(checked) => setPayrollSettings(prev => ({
                          ...prev,
                          deductions: {
                            ...prev.deductions,
                            other: { ...prev.deductions.other, enabled: checked }
                          }
                        }))}
                      />
                    </div>
                    {payrollSettings.deductions.other.enabled && (
                      <div className="space-y-4">
                        {payrollSettings.deductions.other.items.map((item, index) => (
                          <div key={index} className="flex items-center gap-4">
                            <Input
                              value={item.name}
                              onChange={(e) => {
                                const newItems = [...payrollSettings.deductions.other.items]
                                newItems[index] = { ...item, name: e.target.value }
                                setPayrollSettings(prev => ({
                                  ...prev,
                                  deductions: {
                                    ...prev.deductions,
                                    other: { ...prev.deductions.other, items: newItems }
                                  }
                                }))
                              }}
                              placeholder="Deduction Name"
                            />
                            <Input
                              type="number"
                              value={item.percentage}
                              onChange={(e) => {
                                const newItems = [...payrollSettings.deductions.other.items]
                                newItems[index] = { ...item, percentage: Number(e.target.value) }
                                setPayrollSettings(prev => ({
                                  ...prev,
                                  deductions: {
                                    ...prev.deductions,
                                    other: { ...prev.deductions.other, items: newItems }
                                  }
                                }))
                              }}
                              placeholder="Percentage"
                              className="w-24"
                            />
                            <Button
                              variant="outline"
                              onClick={() => {
                                const newItems = payrollSettings.deductions.other.items.filter((_, i) => i !== index)
                                setPayrollSettings(prev => ({
                                  ...prev,
                                  deductions: {
                                    ...prev.deductions,
                                    other: { ...prev.deductions.other, items: newItems }
                                  }
                                }))
                              }}
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          onClick={() => setPayrollSettings(prev => ({
                            ...prev,
                            deductions: {
                              ...prev.deductions,
                              other: {
                                ...prev.deductions.other,
                                items: [...prev.deductions.other.items, { name: '', percentage: 0 }]
                              }
                            }
                          }))}
                        >
                          Add Deduction
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Hourly Rate Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Hourly Rate Settings</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Hourly Rate</Label>
                    <p className="text-sm text-gray-500">Calculate salary based on hours worked</p>
                  </div>
                  <Switch
                    checked={payrollSettings.hourlyRate.enabled}
                    onCheckedChange={(checked) => setPayrollSettings(prev => ({
                      ...prev,
                      hourlyRate: { ...prev.hourlyRate, enabled: checked }
                    }))}
                  />
                </div>
                {payrollSettings.hourlyRate.enabled && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Base Hourly Rate</Label>
                      <Input
                        type="number"
                        value={payrollSettings.hourlyRate.baseRate}
                        onChange={(e) => setPayrollSettings(prev => ({
                          ...prev,
                          hourlyRate: { ...prev.hourlyRate, baseRate: Number(e.target.value) }
                        }))}
                      />
                    </div>
                    <div>
                      <Label>Overtime Multiplier</Label>
                      <Input
                        type="number"
                        value={payrollSettings.hourlyRate.overtimeMultiplier}
                        onChange={(e) => setPayrollSettings(prev => ({
                          ...prev,
                          hourlyRate: { ...prev.hourlyRate, overtimeMultiplier: Number(e.target.value) }
                        }))}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Idle Time Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Idle Time Settings</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Idle Time Tracking</Label>
                    <p className="text-sm text-gray-500">Deduct salary for idle time</p>
                  </div>
                  <Switch
                    checked={payrollSettings.idleTime.enabled}
                    onCheckedChange={(checked) => setPayrollSettings(prev => ({
                      ...prev,
                      idleTime: { ...prev.idleTime, enabled: checked }
                    }))}
                  />
                </div>
                {payrollSettings.idleTime.enabled && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Idle Time Threshold (minutes)</Label>
                      <Input
                        type="number"
                        value={payrollSettings.idleTime.threshold}
                        onChange={(e) => setPayrollSettings(prev => ({
                          ...prev,
                          idleTime: { ...prev.idleTime, threshold: Number(e.target.value) }
                        }))}
                      />
                    </div>
                    <div>
                      <Label>Deduction Percentage</Label>
                      <Input
                        type="number"
                        value={payrollSettings.idleTime.deductionPercentage}
                        onChange={(e) => setPayrollSettings(prev => ({
                          ...prev,
                          idleTime: { ...prev.idleTime, deductionPercentage: Number(e.target.value) }
                        }))}
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-6">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  )
} 