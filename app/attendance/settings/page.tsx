'use client'

import { useState, useEffect } from 'react'
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { useAuth } from "@/contexts/auth-context"
import { db } from "@/lib/firebase"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { toast } from "react-hot-toast"
import { AttendanceSettings } from "@/types/attendance"

const DEFAULT_SETTINGS: AttendanceSettings = {
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

function flattenObject(obj: any, prefix = ''): { [key: string]: any } {
  return Object.keys(obj).reduce((acc: { [key: string]: any }, k: string) => {
    const pre = prefix.length ? prefix + '.' : '';
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      Object.assign(acc, flattenObject(obj[k], pre + k));
    } else {
      acc[pre + k] = obj[k];
    }
    return acc;
  }, {});
}

export default function AttendanceSettingsPage() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<AttendanceSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const settingsRef = doc(db, 'attendance_settings', 'default')
      const settingsDoc = await getDoc(settingsRef)
      
      if (settingsDoc.exists()) {
        setSettings(settingsDoc.data() as AttendanceSettings)
      } else {
        // If no settings exist, create default settings
        const flattenedSettings = flattenObject(DEFAULT_SETTINGS)
        await updateDoc(settingsRef, flattenedSettings)
        setSettings(DEFAULT_SETTINGS)
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const settingsRef = doc(db, 'attendance_settings', 'default')
      const flattenedSettings = flattenObject(settings)
      await updateDoc(settingsRef, flattenedSettings)
      toast.success('Settings saved successfully')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleWorkingHoursChange = (type: 'start' | 'end', value: string) => {
    setSettings(prev => ({
      ...prev,
      workingHours: {
        ...prev.workingHours,
        [type]: value
      }
    }))
  }

  const handleCheckInDaysChange = (day: string) => {
    setSettings(prev => ({
      ...prev,
      requiredCheckInDays: prev.requiredCheckInDays.includes(day)
        ? prev.requiredCheckInDays.filter(d => d !== day)
        : [...prev.requiredCheckInDays, day]
    }))
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-4">
            <div className="max-w-7xl mx-auto">
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto p-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-700">Attendance Settings</h1>
                <p className="text-gray-500">Configure your organization&apos;s attendance rules and policies.</p>
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>

            <div className="space-y-6">
              {/* Working Hours */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Working Hours</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={settings.workingHours.start}
                      onChange={(e) => handleWorkingHoursChange('start', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={settings.workingHours.end}
                      onChange={(e) => handleWorkingHoursChange('end', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Idle Time Settings */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Idle Time Settings</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Idle Threshold (minutes)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={settings.idleThreshold}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        idleThreshold: parseInt(e.target.value)
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Maximum Idle Periods
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={settings.maxIdlePeriods}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        maxIdlePeriods: parseInt(e.target.value)
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Late Arrival Settings */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Late Arrival Settings</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Allowed Late Minutes
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={settings.allowedLateMinutes}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        allowedLateMinutes: parseInt(e.target.value)
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Auto-approve Threshold (minutes)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={settings.autoApproveThreshold}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        autoApproveThreshold: parseInt(e.target.value)
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Location Settings */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Location Settings</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location Radius (meters)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={settings.locationRadius}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      locationRadius: parseInt(e.target.value)
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Required Check-in Days */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Required Check-in Days</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                    <label key={day} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={settings.requiredCheckInDays.includes(day)}
                        onChange={() => handleCheckInDaysChange(day)}
                        className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 capitalize">{day}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Approval Settings */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Approval Settings</h2>
                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={settings.requireManagerApproval}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        requireManagerApproval: e.target.checked
                      }))}
                      className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Require manager approval for attendance</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
} 