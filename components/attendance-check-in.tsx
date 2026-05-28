'use client'

import { useState, useEffect } from 'react'
import { useNewAuth } from '@/contexts/new-auth-context'
import { toast } from 'react-hot-toast'
import { Clock, MapPin, Smartphone, CheckCircle, XCircle } from 'lucide-react'
import { LocationService } from '@/lib/location-service'
import { AttendanceSettings, AttendanceRecord } from '@/types/attendance'
import { LocationSettings } from '@/types/settings'
import { sendLateArrivalNotification } from '@/lib/notifications'
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

interface AttendanceCheckInProps {
  location: { latitude: number; longitude: number } | null
  onSuccess: () => void
}

export function AttendanceCheckIn({ location: initialLocation, onSuccess }: AttendanceCheckInProps) {
  const { user } = useNewAuth()

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

  const defaultLocationSettings: LocationSettings = {
    allowedCountries: ['GH'],
    defaultCountry: 'GH',
    requireLocationValidation: false,
    allowRemoteWork: true,
    officeLocations: [],
    locationValidationRules: {
      requireExactLocation: false,
      allowApproximateLocation: true,
      minimumAccuracy: 100,
      validateOnCheckIn: false,
      validateOnCheckOut: false,
    },
  }

  const [loading, setLoading] = useState(false)
  const [location, setLocation] = useState<Location | null>(
    initialLocation ? { ...initialLocation, accuracy: 0 } : null
  )
  const [error, setError] = useState<string | null>(null)
  const [deviceInfo] = useState({
    browser: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    os: typeof navigator !== 'undefined' ? navigator.platform : '',
  })
  const [officeLocations, setOfficeLocations] = useState<OfficeLocation[]>([])
  const [nearestOffice, setNearestOffice] = useState<OfficeLocation | null>(null)
  const [locationPermission, setLocationPermission] = useState<PermissionState>('prompt')
  const [locationService] = useState(
    () => LocationService.getInstance(defaultAttendanceSettings, defaultLocationSettings)
  )
  const [isTracking, setIsTracking] = useState(false)

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('permissions' in navigator)) return
    navigator.permissions.query({ name: 'geolocation' }).then((permissionStatus) => {
      setLocationPermission(permissionStatus.state)
      permissionStatus.onchange = () => setLocationPermission(permissionStatus.state)
    })
  }, [])

  useEffect(() => {
    const fetchOfficeLocations = async () => {
      try {
        const res = await fetch('/api/attendance/office-locations', { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json()
        setOfficeLocations(data.locations || [])
      } catch (err) {
        console.error('Error fetching office locations:', err)
      }
    }
    fetchOfficeLocations()
  }, [])

  useEffect(() => {
    if (!location || officeLocations.length === 0) return
    let nearest: OfficeLocation | null = null
    let minDistance = Infinity
    officeLocations.forEach((office) => {
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        office.coordinates.lat,
        office.coordinates.lng
      )
      if (distance < minDistance) {
        minDistance = distance
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
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  const handleCheckIn = async () => {
    if (!user) {
      setError('You must be logged in to check in')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const todayRes = await fetch('/api/attendance/records', { credentials: 'include' })
      if (todayRes.ok) {
        const todayData = await todayRes.json()
        if (todayData.todayRecord && !todayData.todayRecord.checkOut) {
          setError('You have already checked in today.')
          setLoading(false)
          return
        }
      }

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
        console.warn('Location capture failed, continuing check-in:', locErr)
      }

      const res = await fetch('/api/attendance/records', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: locationData,
          deviceInfo,
          employeeName: user.name || user.email,
          department: user.department,
        }),
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error || 'Failed to check in')
      }

      const { record } = await res.json()
      await locationService.startTracking(record as AttendanceRecord)
      setIsTracking(true)

      try {
        await sendLateArrivalNotification(user.id, new Date(), defaultAttendanceSettings)
      } catch (notificationError) {
        console.error('Late arrival notification failed:', notificationError)
      }

      toast.success('Check-in successful!')
      onSuccess()
    } catch (err: unknown) {
      console.error('Error checking in:', err)
      setError(err instanceof Error ? err.message : 'Failed to check in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    return () => {
      if (isTracking) locationService.stopTracking()
    }
  }, [isTracking, locationService])

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="mb-4 text-lg font-semibold">Attendance Check-in</h3>

      <div className="mb-4">
        <div className="flex items-center space-x-2">
          <MapPin className="h-5 w-5 text-gray-400" />
          <span className="text-sm text-gray-600">
            {location
              ? 'Location detected'
              : locationPermission === 'denied'
                ? 'Location permission denied'
                : 'Click check-in to get location'}
          </span>
        </div>
        {location && nearestOffice && (
          <p className="mt-1 text-xs text-gray-500">
            Nearest office: {nearestOffice.name} (
            {Math.round(
              calculateDistance(
                location.latitude,
                location.longitude,
                nearestOffice.coordinates.lat,
                nearestOffice.coordinates.lng
              )
            )}
            m away)
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
        onClick={handleCheckIn}
        disabled={loading || locationPermission === 'denied'}
        className={`flex w-full items-center justify-center rounded-md px-4 py-2 ${
          loading || locationPermission === 'denied'
            ? 'bg-gray-100 text-gray-400'
            : 'bg-black text-white hover:bg-gray-800'
        }`}
      >
        {loading ? (
          <>
            <Clock className="mr-2 h-5 w-5 animate-spin" />
            Checking in...
          </>
        ) : locationPermission === 'denied' ? (
          <>
            <XCircle className="mr-2 h-5 w-5" />
            Location Permission Required
          </>
        ) : (
          <>
            <CheckCircle className="mr-2 h-5 w-5" />
            Check In
          </>
        )}
      </button>
    </div>
  )
}
