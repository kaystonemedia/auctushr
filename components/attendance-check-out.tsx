'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore'
import { toast } from 'react-hot-toast'
import { Clock, MapPin, Smartphone, CheckCircle, XCircle } from 'lucide-react'
import { LocationService } from '@/lib/location-service'
import { AttendanceSettings, AttendanceRecord } from '@/types/attendance'
import { LocationSettings } from '@/types/settings'
import { sendEarlyDepartureNotification } from '@/lib/notifications'

interface Location {
  latitude: number
  longitude: number
  accuracy: number
}

interface OfficeLocation {
  id: string;
  name: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  radius: number;
}

interface AttendanceCheckOutProps {
  record: any // TODO: Add proper type for record
  onSuccess: () => void
}

// Add Ghana bounds for validation
const GHANA_BOUNDS = {
  north: 11.17, // Northernmost point
  south: 4.74,  // Southernmost point
  east: 1.19,   // Easternmost point
  west: -3.25   // Westernmost point
}

// Placeholder settings (replace with real settings as needed)
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
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [location, setLocation] = useState<Location | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deviceInfo, setDeviceInfo] = useState({
    userAgent: '',
    platform: '',
    language: '',
    screenResolution: ''
  })
  const [officeLocations, setOfficeLocations] = useState<OfficeLocation[]>([])
  const [nearestOffice, setNearestOffice] = useState<OfficeLocation | null>(null)

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

    // Fetch office locations
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
      }
    }
    fetchOfficeLocations()
  }, [])

  const isWithinGhana = (lat: number, lng: number): boolean => {
    return lat >= GHANA_BOUNDS.south && 
           lat <= GHANA_BOUNDS.north && 
           lng >= GHANA_BOUNDS.west && 
           lng <= GHANA_BOUNDS.east
  }

  const findNearestOffice = (lat: number, lng: number): OfficeLocation | null => {
    if (officeLocations.length === 0) return null

    let nearest: OfficeLocation | null = null
    let minDistance = Infinity

    officeLocations.forEach(office => {
      const distance = calculateDistance(
        lat,
        lng,
        office.coordinates.lat,
        office.coordinates.lng
      )
      if (distance < minDistance) {
        minDistance = distance
        nearest = office
      }
    })

    return nearest
  }

  const validateLocation = async () => {
    if (!location) return false

    try {
      // First check if location is within Ghana
      if (!isWithinGhana(location.latitude, location.longitude)) {
        setError('Location must be within Ghana.')
        return false
      }

      // Find nearest office for reference
      const nearest = findNearestOffice(location.latitude, location.longitude)
      setNearestOffice(nearest)

      // If there are office locations, check if user is near any of them
      if (officeLocations.length > 0) {
        const isNearOffice = officeLocations.some(office => {
          const distance = calculateDistance(
            location.latitude,
            location.longitude,
            office.coordinates.lat,
            office.coordinates.lng
          )
          return distance <= office.radius
        })

        if (!isNearOffice) {
          setError('You are not near any registered office location. Please check out from a valid location.')
          return false
        }
      }

      return true
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

  const handleCheckOut = async () => {
    if (!user || !location) return

    try {
      setLoading(true)
      setError(null)

      // Validate location
      const isValidLocation = await validateLocation()
      if (!isValidLocation) {
        setError('You must be at the office location to check out.')
        return
      }

      // Find today's attendance record
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('employeeId', '==', user.id),
        where('date', '>=', today)
      )
      const attendanceSnapshot = await getDocs(attendanceQuery)

      if (attendanceSnapshot.empty) {
        setError('No active check-in found for today.')
        return
      }

      const attendanceDoc = attendanceSnapshot.docs[0]
      const attendanceData = attendanceDoc.data()

      // Check if already checked out
      if (attendanceData.checkOut) {
        setError('You have already checked out today.')
        return
      }

      // Update attendance record with check-out information
      const checkOutData = {
        time: new Date(),
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy
        },
        deviceInfo
      }

      // Calculate work duration
      const checkInTime = new Date(attendanceData.checkIn.time)
      const checkOutTime = new Date()
      const workDuration = checkOutTime.getTime() - checkInTime.getTime()
      const workHours = workDuration / (1000 * 60 * 60)

      // Determine attendance status based on work hours
      let status = attendanceData.status
      if (workHours < 4) {
        status = 'half_day'
      } else if (workHours < 8) {
        status = 'early_leave'
      }

      await updateDoc(doc(db, 'attendance', attendanceDoc.id), {
        checkOut: checkOutData,
        status,
        updatedAt: new Date()
      })

      // Send notification for early departure if applicable
      try {
        await sendEarlyDepartureNotification(user.id, new Date(), defaultAttendanceSettings)
      } catch (notificationError) {
        console.error('Error sending early departure notification:', notificationError)
        // Don't fail the check-out if notification fails
      }

      toast.success('Check-out successful!')
      onSuccess()
    } catch (error) {
      console.error('Error checking out:', error)
      setError('Failed to check out. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold mb-4">Attendance Check-out</h3>
      
      {/* Location Status */}
      <div className="mb-4">
        <div className="flex items-center space-x-2">
          <MapPin className="h-5 w-5 text-gray-400" />
          <span className="text-sm text-gray-600">
            {location ? 'Location detected' : 'Getting location...'}
          </span>
        </div>
        {location && (
          <>
            <p className="text-xs text-gray-500 mt-1">
              Accuracy: {Math.round(location.accuracy)} meters
            </p>
            {nearestOffice && (
              <p className="text-xs text-gray-500 mt-1">
                Nearest office: {nearestOffice.name} ({Math.round(calculateDistance(
                  location.latitude,
                  location.longitude,
                  nearestOffice.coordinates.lat,
                  nearestOffice.coordinates.lng
                ))}m away)
              </p>
            )}
          </>
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

      {/* Check-out Button */}
      <button
        onClick={handleCheckOut}
        disabled={loading || !location}
        className={`w-full flex items-center justify-center px-4 py-2 rounded-md ${
          loading || !location
            ? 'bg-gray-100 text-gray-400'
            : 'bg-red-500 text-white hover:bg-red-600'
        }`}
      >
        {loading ? (
          <>
            <Clock className="h-5 w-5 mr-2 animate-spin" />
            Checking out...
          </>
        ) : !location ? (
          <>
            <Clock className="h-5 w-5 mr-2" />
            Waiting for location...
          </>
        ) : (
          <>
            <XCircle className="h-5 w-5 mr-2" />
            Check Out
          </>
        )}
      </button>
    </div>
  )
} 