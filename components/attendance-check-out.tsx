'use client'

import { useState, useEffect } from 'react'
import { useNewAuth } from '@/contexts/new-auth-context'
import { toast } from 'react-hot-toast'
import { Clock, MapPin, Smartphone, XCircle } from 'lucide-react'
import { AttendanceSettings, AttendanceRecord } from '@/types/attendance'
import { sendEarlyDepartureNotification } from '@/lib/notifications'
import { captureLocation } from '@/lib/location-helper'

interface Location {
  latitude: number
  longitude: number
  accuracy: number
}

interface OfficeLocation {
  id: string
  name: string
  coordinates: { lat: number; lng: number }
  radius: number
}

interface AttendanceCheckOutProps {
  record: AttendanceRecord
  onSuccess: () => void
}

const defaultAttendanceSettings: AttendanceSettings = {
  workingHours: { start: '09:00', end: '18:00' },
  idleThreshold: 15,
  maxIdlePeriods: 3,
  allowedLateMinutes: 10,
  locationRadius: 100,
  requiredCheckInDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  requireManagerApproval: false,
  autoApproveThreshold: 5,
}

export function AttendanceCheckOut({ record, onSuccess }: AttendanceCheckOutProps) {
  const { user } = useNewAuth()
  const [loading, setLoading] = useState(false)
  const [location, setLocation] = useState<Location | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deviceInfo, setDeviceInfo] = useState({
    userAgent: '',
    platform: '',
    language: '',
    screenResolution: '',
  })
  const [officeLocations, setOfficeLocations] = useState<OfficeLocation[]>([])
  const [nearestOffice, setNearestOffice] = useState<OfficeLocation | null>(null)

  useEffect(() => {
    setDeviceInfo({
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
    })

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          })
        },
        () => setError('Unable to get your location. Check-in/out will still work without it.')
      )
    }

    fetch('/api/attendance/office-locations', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { locations: [] }))
      .then((data) => setOfficeLocations(data.locations || []))
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (!location || officeLocations.length === 0) return
    let nearest: OfficeLocation | null = null
    let minDistance = Infinity
    officeLocations.forEach((office) => {
      const d = calculateDistance(
        location.latitude,
        location.longitude,
        office.coordinates.lat,
        office.coordinates.lng
      )
      if (d < minDistance) {
        minDistance = d
        nearest = office
      }
    })
    setNearestOffice(nearest)
  }, [location, officeLocations])

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const Δφ = ((lat2 - lat1) * Math.PI) / 180
    const Δλ = ((lon2 - lon1) * Math.PI) / 180
    const a =
      Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
  }

  const handleCheckOut = async () => {
    if (!user) {
      setError('You must be logged in to check out')
      return
    }
    if (record.checkOut) {
      setError('You have already checked out today.')
      return
    }

    try {
      setLoading(true)
      setError(null)

      let locationData: Record<string, unknown> | null = null
      try {
        const captured = await captureLocation()
        if (captured) {
          locationData = captured
          setLocation({
            latitude: captured.latitude,
            longitude: captured.longitude,
            accuracy: captured.accuracy,
          })
        }
      } catch (locErr) {
        console.warn('Location capture failed:', locErr)
      }

      const res = await fetch(`/api/attendance/records/${record.id}/checkout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: locationData,
          deviceInfo,
          idleTimeMinutes: record.idleTimeTotal || 0,
        }),
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error || 'Failed to check out')
      }

      try {
        await sendEarlyDepartureNotification(user.id, new Date(), defaultAttendanceSettings)
      } catch (notificationError) {
        console.error('Early departure notification failed:', notificationError)
      }

      toast.success('Check-out successful!')
      onSuccess()
    } catch (err: unknown) {
      console.error('Error checking out:', err)
      setError(err instanceof Error ? err.message : 'Failed to check out. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="mb-4 text-lg font-semibold">Attendance Check-out</h3>

      <div className="mb-4">
        <div className="flex items-center space-x-2">
          <MapPin className="h-5 w-5 text-gray-400" />
          <span className="text-sm text-gray-600">
            {location ? 'Location detected' : 'Getting location (optional)...'}
          </span>
        </div>
        {location && nearestOffice && (
          <p className="mt-1 text-xs text-gray-500">
            Nearest office: {nearestOffice.name}
          </p>
        )}
      </div>

      <div className="mb-4">
        <div className="flex items-center space-x-2">
          <Smartphone className="h-5 w-5 text-gray-400" />
          <span className="text-sm text-gray-600">Device verified</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <button
        type="button"
        onClick={handleCheckOut}
        disabled={loading}
        className={`flex w-full items-center justify-center rounded-md px-4 py-2 ${
          loading ? 'bg-gray-100 text-gray-400' : 'bg-red-500 text-white hover:bg-red-600'
        }`}
      >
        {loading ? (
          <>
            <Clock className="mr-2 h-5 w-5 animate-spin" />
            Checking out...
          </>
        ) : (
          <>
            <XCircle className="mr-2 h-5 w-5" />
            Check Out
          </>
        )}
      </button>
    </div>
  )
}
