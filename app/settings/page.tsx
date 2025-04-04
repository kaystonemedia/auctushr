'use client'

import { useState, useEffect } from 'react'
import { db } from "@/lib/firebase"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { toast } from "react-hot-toast"
import { AttendanceSettings, SystemSettings } from "@/types/settings"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("attendance")
  const [attendanceSettings, setAttendanceSettings] = useState<AttendanceSettings>(DEFAULT_ATTENDANCE_SETTINGS)
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, "settings", "company"))
        if (settingsDoc.exists()) {
          const data = settingsDoc.data()
          setAttendanceSettings(data.attendance || DEFAULT_ATTENDANCE_SETTINGS)
          setSystemSettings(data.system || DEFAULT_SYSTEM_SETTINGS)
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

      await setDoc(settingsRef, {
        attendance: flattenedAttendance,
        system: flattenedSystem
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your company settings and preferences</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="attendance">Attendance Settings</TabsTrigger>
          <TabsTrigger value="system">System Settings</TabsTrigger>
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
                      value={attendanceSettings.workingHours.start}
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
                      value={attendanceSettings.workingHours.end}
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

        <TabsContent value="system" className="mt-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Company Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input
                    value={systemSettings.companyName}
                    onChange={(e) => handleSystemChange('companyName', e.target.value)}
                  />
                </div>

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
                      <SelectItem value="America/New_York">Eastern Time</SelectItem>
                      <SelectItem value="America/Chicago">Central Time</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Notification Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={systemSettings.emailNotifications}
                      onCheckedChange={(checked: boolean) => handleSystemChange('emailNotifications', checked)}
                    />
                    <Label>Email Notifications</Label>
                  </div>
                </div>

                <div className="space-y-4">
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
      </Tabs>
    </div>
  )
} 