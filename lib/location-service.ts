import { db } from './firebase'
import { collection, doc, updateDoc, arrayUnion, Timestamp, getDocs, addDoc, query, where } from 'firebase/firestore'
import { AttendanceRecord, AttendanceSettings } from '@/types/attendance'
import { OfficeLocation, LocationSettings } from '@/types/settings'
import { countries } from './countries'

export class LocationService {
  private static instance: LocationService
  private watchId: number | null = null
  private currentRecord: AttendanceRecord | null = null
  private settings: AttendanceSettings
  private locationSettings: LocationSettings
  private officeLocations: OfficeLocation[] = []

  private constructor(settings: AttendanceSettings, locationSettings: LocationSettings) {
    this.settings = settings
    this.locationSettings = locationSettings
    this.loadOfficeLocations()
  }

  public static getInstance(settings: AttendanceSettings, locationSettings: LocationSettings): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService(settings, locationSettings)
    }
    return LocationService.instance
  }

  private async loadOfficeLocations(): Promise<void> {
    try {
      const locationsRef = collection(db, 'office_locations')
      const q = query(locationsRef, where('isActive', '==', true))
      const snapshot = await getDocs(q)
      this.officeLocations = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as OfficeLocation[]
    } catch (error) {
      console.error('Error loading office locations:', error)
    }
  }

  public async validateLocation(latitude: number, longitude: number, countryCode?: string): Promise<{
    isValid: boolean
    location?: OfficeLocation
    distance?: number
    countryValid?: boolean
    message?: string
  }> {
    // First validate country if required
    if (this.locationSettings.requireLocationValidation && countryCode) {
      const isCountryAllowed = this.locationSettings.allowedCountries.includes(countryCode)
      if (!isCountryAllowed) {
        return {
          isValid: false,
          countryValid: false,
          message: `Check-in not allowed in ${countries.find(c => c.code === countryCode)?.name}. Allowed countries: ${this.locationSettings.allowedCountries.map(code => countries.find(c => c.code === code)?.name).join(', ')}`
        }
      }
    }

    // If remote work is allowed and we're in an allowed country, no need to check office location
    if (this.locationSettings.allowRemoteWork && countryCode && this.locationSettings.allowedCountries.includes(countryCode)) {
      return {
        isValid: true,
        countryValid: true,
        message: 'Remote work location validated'
      }
    }

    // Validate against office locations
    let nearestLocation: OfficeLocation | undefined
    let minDistance = Infinity

    for (const location of this.officeLocations) {
      const distance = this.calculateDistance(
        latitude,
        longitude,
        location.latitude,
        location.longitude
      )

      if (distance < minDistance) {
        minDistance = distance
        nearestLocation = location
      }

      if (distance <= location.radius) {
        return {
          isValid: true,
          location,
          distance,
          countryValid: true,
          message: `Location validated against ${location.name}`
        }
      }
    }

    // If we have a nearest location but it's too far
    if (nearestLocation) {
      return {
        isValid: false,
        location: nearestLocation,
        distance: minDistance,
        countryValid: true,
        message: `Location is ${Math.round(minDistance)}m from nearest office (${nearestLocation.name}). Maximum allowed distance is ${nearestLocation.radius}m.`
      }
    }

    return {
      isValid: false,
      countryValid: true,
      message: 'No office locations found'
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

  public startLocationTracking(record: AttendanceRecord): void {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported by this browser.')
      return
    }

    this.currentRecord = record
    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.handleLocationUpdate(position),
      (error) => this.handleLocationError(error),
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    )
  }

  private async handleLocationUpdate(position: GeolocationPosition): Promise<void> {
    if (!this.currentRecord) return

    const { latitude, longitude, accuracy } = position.coords
    const locationData = {
      latitude,
      longitude,
      accuracy,
      timestamp: new Date()
    }

    // Update attendance record with location history
    const attendanceRef = doc(db, 'attendance', this.currentRecord.id)
    await updateDoc(attendanceRef, {
      locationHistory: arrayUnion(locationData)
    })

    // Validate location and handle any issues
    const validation = await this.validateLocation(latitude, longitude)
    if (!validation.isValid) {
      await this.handleLocationMismatch(validation.distance || 0, validation.location || { id: '', name: '', latitude: 0, longitude: 0, radius: 0 })
    }
  }

  private async handleLocationMismatch(distance: number, location: OfficeLocation): Promise<void> {
    if (!this.currentRecord) return

    const attendanceRef = doc(db, 'attendance', this.currentRecord.id)
    await updateDoc(attendanceRef, {
      flags: arrayUnion({
        type: 'location_mismatch',
        description: `Location mismatch detected (${Math.round(distance)}m from ${location.name})`,
        severity: 'high',
        timestamp: Timestamp.now()
      })
    })

    // Send notification to manager
    await this.sendLocationMismatchNotification(distance, location)
  }

  private async sendLocationMismatchNotification(distance: number, location: OfficeLocation): Promise<void> {
    if (!this.currentRecord) return

    const notificationRef = collection(db, 'notifications')
    await addDoc(notificationRef, {
      type: 'location_mismatch',
      employeeId: this.currentRecord.employeeId,
      employeeName: this.currentRecord.employeeName,
      managerId: this.currentRecord.managerId,
      message: `${this.currentRecord.employeeName} is ${Math.round(distance)}m from ${location.name}`,
      timestamp: Timestamp.now(),
      status: 'unread',
      attendanceId: this.currentRecord.id
    })
  }

  private handleLocationError(error: GeolocationPositionError): void {
    console.error('Geolocation error:', error)
    // Handle different types of geolocation errors
    switch (error.code) {
      case error.PERMISSION_DENIED:
        console.error('Location permission denied')
        break
      case error.POSITION_UNAVAILABLE:
        console.error('Location information unavailable')
        break
      case error.TIMEOUT:
        console.error('Location request timed out')
        break
      default:
        console.error('Unknown geolocation error')
    }
  }

  public stopLocationTracking(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId)
      this.watchId = null
    }
    this.currentRecord = null
  }

  public async getCountryFromCoordinates(latitude: number, longitude: number): Promise<string | null> {
    try {
      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
      )
      const data = await response.json()
      return data.countryCode || null
    } catch (error) {
      console.error('Error getting country from coordinates:', error)
      return null
    }
  }
} 