'use client'

import { useState, useEffect } from 'react'
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { useNewAuth } from "@/contexts/new-auth-context"
import { db } from "@/lib/firebase"
import { doc, getDoc, updateDoc, collection, addDoc, getDocs, query, where, deleteDoc } from "firebase/firestore"
import { toast } from "react-hot-toast"
import { AttendanceSettings } from "@/types/attendance"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { MapPin, Plus, Trash2, Edit2 } from "lucide-react"

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

interface OfficeLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  region: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  radius: number; // in meters
  isActive: boolean;
}

export default function AttendanceSettingsPage() {
  const { user } = useNewAuth()
  const [settings, setSettings] = useState<AttendanceSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [officeLocations, setOfficeLocations] = useState<OfficeLocation[]>([])
  const [newLocation, setNewLocation] = useState<Partial<OfficeLocation>>({
    name: '',
    address: '',
    city: '',
    region: '',
    coordinates: { lat: 0, lng: 0 },
    radius: 100,
    isActive: true
  })
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    fetchSettings()
    fetchOfficeLocations()
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

  const fetchOfficeLocations = async () => {
    try {
      const q = query(collection(db, "officeLocations"))
      const snapshot = await getDocs(q)
      const locations = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as OfficeLocation[]
      setOfficeLocations(locations)
    } catch (error) {
      console.error("Error fetching office locations:", error)
      toast.error("Failed to fetch office locations")
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

  const handleAddLocation = async () => {
    try {
      if (!newLocation.name || !newLocation.address || !newLocation.city || !newLocation.region) {
        toast.error("Please fill in all required fields")
        return
      }

      const docRef = await addDoc(collection(db, "officeLocations"), {
        ...newLocation,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      setOfficeLocations(prev => [...prev, { id: docRef.id, ...newLocation } as OfficeLocation])
      setNewLocation({
        name: '',
        address: '',
        city: '',
        region: '',
        coordinates: { lat: 0, lng: 0 },
        radius: 100,
        isActive: true
      })
      toast.success("Office location added successfully")
    } catch (error) {
      console.error("Error adding office location:", error)
      toast.error("Failed to add office location")
    }
  }

  const handleUpdateLocation = async (id: string) => {
    try {
      const location = officeLocations.find(loc => loc.id === id)
      if (!location) return

      await updateDoc(doc(db, "officeLocations", id), {
        ...location,
        updatedAt: new Date()
      })

      setOfficeLocations(prev => prev.map(loc => 
        loc.id === id ? { ...loc, ...location } : loc
      ))
      setIsEditing(false)
      setEditingId(null)
      toast.success("Office location updated successfully")
    } catch (error) {
      console.error("Error updating office location:", error)
      toast.error("Failed to update office location")
    }
  }

  const handleDeleteLocation = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this office location?")) return

    try {
      await deleteDoc(doc(db, "officeLocations", id))
      setOfficeLocations(prev => prev.filter(loc => loc.id !== id))
      toast.success("Office location deleted successfully")
    } catch (error) {
      console.error("Error deleting office location:", error)
      toast.error("Failed to delete office location")
    }
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

              {/* Office Locations Management */}
              <Card>
                <CardHeader>
                  <CardTitle>Office Locations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Add/Edit Location Form */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Office Name</label>
                        <Input
                          type="text"
                          value={newLocation.name}
                          onChange={(e) => setNewLocation(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Enter office name"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Address</label>
                        <Input
                          type="text"
                          value={newLocation.address}
                          onChange={(e) => setNewLocation(prev => ({ ...prev, address: e.target.value }))}
                          placeholder="Enter full address"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">City</label>
                        <Input
                          type="text"
                          value={newLocation.city}
                          onChange={(e) => setNewLocation(prev => ({ ...prev, city: e.target.value }))}
                          placeholder="Enter city"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Region</label>
                        <Input
                          type="text"
                          value={newLocation.region}
                          onChange={(e) => setNewLocation(prev => ({ ...prev, region: e.target.value }))}
                          placeholder="Enter region"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Latitude</label>
                        <Input
                          type="number"
                          value={newLocation.coordinates?.lat}
                          onChange={(e) => setNewLocation(prev => ({
                            ...prev,
                            coordinates: { ...prev.coordinates!, lat: parseFloat(e.target.value) }
                          }))}
                          placeholder="Enter latitude"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Longitude</label>
                        <Input
                          type="number"
                          value={newLocation.coordinates?.lng}
                          onChange={(e) => setNewLocation(prev => ({
                            ...prev,
                            coordinates: { ...prev.coordinates!, lng: parseFloat(e.target.value) }
                          }))}
                          placeholder="Enter longitude"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Radius (meters)</label>
                        <Input
                          type="number"
                          value={newLocation.radius}
                          onChange={(e) => setNewLocation(prev => ({ ...prev, radius: parseInt(e.target.value) }))}
                          placeholder="Enter radius in meters"
                          className="mt-1"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          onClick={isEditing ? () => handleUpdateLocation(editingId!) : handleAddLocation}
                          className="w-full"
                        >
                          {isEditing ? 'Update Location' : 'Add Location'}
                        </Button>
                      </div>
                    </div>

                    {/* Locations List */}
                    <div className="space-y-4">
                      {officeLocations.map(location => (
                        <div key={location.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="space-y-1">
                            <h3 className="font-medium">{location.name}</h3>
                            <p className="text-sm text-gray-500">{location.address}, {location.city}, {location.region}</p>
                            <p className="text-sm text-gray-500">
                              Coordinates: {location.coordinates.lat}, {location.coordinates.lng} | 
                              Radius: {location.radius}m
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setNewLocation(location)
                                setIsEditing(true)
                                setEditingId(location.id)
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteLocation(location.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
} 