'use client'

import { useState, useEffect } from 'react'
import { useNewAuth } from '@/contexts/new-auth-context'
import { db } from '@/lib/firebase'
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore'
import { toast } from 'react-hot-toast'
import { Clock, MapPin, Smartphone, CheckCircle, XCircle } from 'lucide-react'
import { LocationService } from '@/lib/location-service'
import { AttendanceSettings, AttendanceRecord } from '@/types/attendance'
import { LocationSettings } from '@/types/settings'
import { sendLateArrivalNotification } from '@/lib/notifications'

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

interface AttendanceCheckInProps {
  location: { latitude: number; longitude: number } | null
  onSuccess: () => void
}

// Add Ghana bounds for validation
const GHANA_BOUNDS = {
  north: 11.17, // Northernmost point
  south: 4.74,  // Southernmost point
  east: 1.19,   // Easternmost point
  west: -3.25   // Westernmost point
}

export function AttendanceCheckIn({ location: initialLocation, onSuccess }: AttendanceCheckInProps) {
  const { user } = useNewAuth()
  
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
  const [location, setLocation] = useState<Location | null>(initialLocation ? {
    ...initialLocation,
    accuracy: 0
  } : null)
  const [error, setError] = useState<string | null>(null)
  const [deviceInfo, setDeviceInfo] = useState({
    browser: navigator.userAgent,
    os: navigator.platform,
    // ip: '' // Optionally add IP if available
  })
  const [officeLocations, setOfficeLocations] = useState<OfficeLocation[]>([])
  const [nearestOffice, setNearestOffice] = useState<OfficeLocation | null>(null)
  const [locationPermission, setLocationPermission] = useState<PermissionState>('prompt')
  const [locationService] = useState(() => LocationService.getInstance(defaultAttendanceSettings, defaultLocationSettings))
  const [isTracking, setIsTracking] = useState(false)

  // Get current location
  const getCurrentLocation = (): Promise<Location> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'))
        return
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          }
          setLocation(location)
          resolve(location)
        },
        (error) => {
          let errorMessage = 'Failed to get location'
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location permission denied'
              setLocationPermission('denied')
              break
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information is unavailable'
              break
            case error.TIMEOUT:
              errorMessage = 'Location request timed out'
              break
          }
          reject(new Error(errorMessage))
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      )
    })
  }

  // Check location permission status
  useEffect(() => {
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' })
        .then(permissionStatus => {
          setLocationPermission(permissionStatus.state)
          permissionStatus.onchange = () => {
            setLocationPermission(permissionStatus.state)
          }
        })
    }
  }, [])

  useEffect(() => {
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
          setError('You are not near any registered office location. Please check in from a valid location.')
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

  const handleCheckIn = async () => {
    if (!user) {
      setError('You must be logged in to check in')
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Get current location
      const currentLocation = await getCurrentLocation()

      // Validate location
      const isValidLocation = await validateLocation()
      if (!isValidLocation) {
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
        employeeName: user.name || user.email,
        department: user.department || 'Unknown',
        date: new Date(),
        checkIn: {
          time: new Date(),
          location: {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            accuracy: currentLocation.accuracy
          },
          deviceInfo: deviceInfo,
        },
        status: 'present',
        approvalStatus: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const docRef = await addDoc(collection(db, 'attendance'), attendanceData)
      
      // Start location tracking
      const record = {
        id: docRef.id,
        ...attendanceData
      } as AttendanceRecord
      
      await locationService.startTracking(record)
      setIsTracking(true)

      // Send notification for late arrival if applicable
      try {
        await sendLateArrivalNotification(user.id, new Date(), defaultAttendanceSettings)
      } catch (notificationError) {
        console.error('Error sending late arrival notification:', notificationError)
        // Don't fail the check-in if notification fails
      }

      toast.success('Check-in successful!')
      onSuccess()
    } catch (error: any) {
      console.error('Error checking in:', error)
      setError(error.message || 'Failed to check in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Cleanup location tracking on unmount
  useEffect(() => {
    return () => {
      if (isTracking) {
        locationService.stopTracking()
      }
    }
  }, [isTracking, locationService])

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold mb-4">Attendance Check-in</h3>
      
      {/* Location Status */}
      <div className="mb-4">
        <div className="flex items-center space-x-2">
          <MapPin className="h-5 w-5 text-gray-400" />
          <span className="text-sm text-gray-600">
            {location ? 'Location detected' : locationPermission === 'denied' ? 
              'Location permission denied' : 'Click check-in to get location'}
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

      {/* Check-in Button */}
      <button
        onClick={handleCheckIn}
        disabled={loading || locationPermission === 'denied'}
        className={`w-full flex items-center justify-center px-4 py-2 rounded-md ${
          loading || locationPermission === 'denied'
            ? 'bg-gray-100 text-gray-400'
            : 'bg-black text-white hover:bg-gray-800'
        }`}
      >
        {loading ? (
          <>
            <Clock className="h-5 w-5 mr-2 animate-spin" />
            Checking in...
          </>
        ) : locationPermission === 'denied' ? (
          <>
            <XCircle className="h-5 w-5 mr-2" />
            Location Permission Required
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