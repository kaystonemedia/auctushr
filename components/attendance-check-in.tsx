'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { db } from '@/lib/firebase'
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore'
import { toast } from 'react-hot-toast'
import { Clock, MapPin, Smartphone, CheckCircle, XCircle } from 'lucide-react'

interface Location {
  latitude: number
  longitude: number
  accuracy: number
}

interface AttendanceCheckInProps {
  location: { latitude: number; longitude: number } | null
  onSuccess: () => void
}

export function AttendanceCheckIn({ location: initialLocation, onSuccess }: AttendanceCheckInProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [location, setLocation] = useState<Location | null>(initialLocation ? {
    ...initialLocation,
    accuracy: 0
  } : null)
  const [error, setError] = useState<string | null>(null)
  const [deviceInfo, setDeviceInfo] = useState({
    userAgent: '',
    platform: '',
    language: '',
    screenResolution: ''
  })

  useEffect(() => {
    // Get device information
    setDeviceInfo({
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${window.screen.width}x${window.screen.height}`
    })

    // Get current location
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          })
        },
        (error) => {
          setError('Unable to get your location. Please enable location services.')
          console.error('Geolocation error:', error)
        }
      )
    } else {
      setError('Geolocation is not supported by your browser.')
    }
  }, [])

  const validateLocation = async () => {
    if (!location) return false

    try {
      // Get office location from settings (you'll need to implement this)
      const officeLocation = {
        latitude: 0, // Replace with actual office coordinates
        longitude: 0,
        radius: 100 // Maximum allowed distance in meters
      }

      // Calculate distance between current location and office
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        officeLocation.latitude,
        officeLocation.longitude
      )

      return distance <= officeLocation.radius
    } catch (error) {
      console.error('Error validating location:', error)
      return false
    }
  }

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3 // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const Δφ = ((lat2 - lat1) * Math.PI) / 180
    const Δλ = ((lon2 - lon1) * Math.PI) / 180

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c // Distance in meters
  }

  const handleCheckIn = async () => {
    if (!user || !location) return

    try {
      setLoading(true)
      setError(null)

      // Validate location
      const isValidLocation = await validateLocation()
      if (!isValidLocation) {
        setError('You must be at the office location to check in.')
        return
      }

      // Check if already checked in today
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const checkInQuery = query(
        collection(db, 'attendance'),
        where('employeeId', '==', user.id),
        where('date', '>=', today)
      )
      const existingCheckIn = await getDocs(checkInQuery)

      if (!existingCheckIn.empty) {
        setError('You have already checked in today.')
        return
      }

      // Create attendance record
      const attendanceData = {
        employeeId: user.id,
        employeeName: user.name,
        department: user.department,
        date: new Date(),
        checkIn: {
          time: new Date(),
          location: {
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy
          },
          deviceInfo
        },
        status: 'present',
        approvalStatus: 'pending'
      }

      await addDoc(collection(db, 'attendance'), attendanceData)
      toast.success('Check-in successful!')
      onSuccess()
    } catch (error) {
      console.error('Error checking in:', error)
      setError('Failed to check in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold mb-4">Attendance Check-in</h3>
      
      {/* Location Status */}
      <div className="mb-4">
        <div className="flex items-center space-x-2">
          <MapPin className="h-5 w-5 text-gray-400" />
          <span className="text-sm text-gray-600">
            {location ? 'Location detected' : 'Getting location...'}
          </span>
        </div>
        {location && (
          <p className="text-xs text-gray-500 mt-1">
            Accuracy: {Math.round(location.accuracy)} meters
          </p>
        )}
      </div>

      {/* Device Info */}
      <div className="mb-4">
        <div className="flex items-center space-x-2">
          <Smartphone className="h-5 w-5 text-gray-400" />
          <span className="text-sm text-gray-600">Device verified</span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Check-in Button */}
      <button
        onClick={handleCheckIn}
        disabled={loading || !location}
        className={`w-full flex items-center justify-center px-4 py-2 rounded-md ${
          loading || !location
            ? 'bg-gray-100 text-gray-400'
            : 'bg-black text-white hover:bg-gray-800'
        }`}
      >
        {loading ? (
          <>
            <Clock className="h-5 w-5 mr-2 animate-spin" />
            Checking in...
          </>
        ) : !location ? (
          <>
            <Clock className="h-5 w-5 mr-2" />
            Waiting for location...
          </>
        ) : (
          <>
            <CheckCircle className="h-5 w-5 mr-2" />
            Check In
          </>
        )}
      </button>
    </div>
  )
} 