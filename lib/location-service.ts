import { db } from '@/lib/firebase'
import { collection, doc, updateDoc, arrayUnion, Timestamp, getDocs, addDoc, query, where } from 'firebase/firestore'
import { AttendanceRecord, AttendanceSettings } from '@/types/attendance'
import { LocationSettings, OfficeLocation } from '@/types/settings'
import { countries } from './countries'

interface LocationData {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: Date
  address?: string
}

export class LocationService {
  private static instance: LocationService | null = null
  private watchId: number | null = null
  private currentRecord: AttendanceRecord | null = null
  private settings: AttendanceSettings
  private locationSettings: LocationSettings
  private officeLocations: OfficeLocation[] = []
  private locationHistory: LocationData[] = []
  private lastAddressUpdate: Date | null = null
  private readonly ADDRESS_UPDATE_INTERVAL = 5 * 60 * 1000 // 5 minutes

  private constructor(settings: AttendanceSettings, locationSettings: LocationSettings) {
    this.settings = settings
    this.locationSettings = locationSettings
    this.loadOfficeLocations()
  }

  public static getInstance(settings: AttendanceSettings, locationSettings: LocationSettings): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService(settings, locationSettings)
    } else {
      // Update settings if instance exists
      LocationService.instance.updateSettings(settings, locationSettings)
    }
    return LocationService.instance
  }

  private updateSettings(settings: AttendanceSettings, locationSettings: LocationSettings): void {
    this.settings = settings
    this.locationSettings = locationSettings
    this.loadOfficeLocations() // Reload office locations with new settings
  }

  private async loadOfficeLocations(): Promise<void> {
    try {
      const locationsRef = collection(db, 'officeLocations')
      const q = query(locationsRef, where('isActive', '==', true))
      const snapshot = await getDocs(q)
      this.officeLocations = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as OfficeLocation[]
    } catch (error) {
      console.error('Error loading office locations:', error)
      this.officeLocations = [] // Reset to empty array on error
    }
  }

  public async validateLocation(latitude: number, longitude: number, countryCode?: string): Promise<{
    isValid: boolean
    location?: OfficeLocation
    distance?: number
    countryValid?: boolean
    message?: string
  }> {
    // Ensure settings are loaded
    if (!this.locationSettings || !this.settings) {
      throw new Error('Location service settings not initialized')
    }

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

  public async startTracking(record: AttendanceRecord): Promise<void> {
    this.currentRecord = record
    this.locationHistory = []

    if ('geolocation' in navigator) {
      // Start continuous tracking
      this.watchId = navigator.geolocation.watchPosition(
        this.handleLocationUpdate.bind(this),
        this.handleLocationError.bind(this),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      )

      // Initial location check
      navigator.geolocation.getCurrentPosition(
        this.handleLocationUpdate.bind(this),
        this.handleLocationError.bind(this),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      )
    }
  }

  public stopTracking(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId)
      this.watchId = null
    }
    this.currentRecord = null
    this.locationHistory = []
  }

  private async handleLocationUpdate(position: GeolocationPosition): Promise<void> {
    if (!this.currentRecord) return

    const { latitude, longitude, accuracy } = position.coords
    const locationData: LocationData = {
      latitude,
      longitude,
      accuracy,
      timestamp: new Date()
    }

    // Update address periodically
    if (!this.lastAddressUpdate || 
        Date.now() - this.lastAddressUpdate.getTime() > this.ADDRESS_UPDATE_INTERVAL) {
      try {
        const address = await this.getAddressFromCoordinates(latitude, longitude)
        locationData.address = address
        this.lastAddressUpdate = new Date()
      } catch (error) {
        console.error('Error getting address:', error)
      }
    }

    // Add to location history
    this.locationHistory.push(locationData)

    // Update attendance record with location history
    const attendanceRef = doc(db, 'attendance', this.currentRecord.id)
    await updateDoc(attendanceRef, {
      locationHistory: arrayUnion(locationData)
    })

    // Validate location and handle any issues
    const validation = await this.validateLocation(latitude, longitude)
    if (!validation.isValid) {
      await this.handleLocationMismatch(validation.distance || 0, validation.location || { 
        id: '', 
        name: '', 
        address: '',
        city: '',
        country: '',
        latitude: 0, 
        longitude: 0, 
        radius: 0,
        workingHours: { start: '09:00', end: '17:00' },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    }

    // Check for suspicious movement patterns
    await this.detectSuspiciousMovement()
  }

  private async getAddressFromCoordinates(lat: number, lng: number): Promise<string> {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
      )
      const data = await response.json()
      if (data.results && data.results[0]) {
        return data.results[0].formatted_address
      }
      return 'Address not found'
    } catch (error) {
      console.error('Error getting address:', error)
      return 'Address lookup failed'
    }
  }

  private async detectSuspiciousMovement() {
    if (this.locationHistory.length < 2) return

    const recentLocations = this.locationHistory.slice(-5)
    let totalDistance = 0
    let suspiciousMovements = 0

    for (let i = 1; i < recentLocations.length; i++) {
      const prev = recentLocations[i - 1]
      const curr = recentLocations[i]
      const distance = this.calculateDistance(
        prev.latitude,
        prev.longitude,
        curr.latitude,
        curr.longitude
      )
      const timeDiff = (curr.timestamp.getTime() - prev.timestamp.getTime()) / 1000 // in seconds
      
      // Calculate speed in km/h
      const speed = (distance / 1000) / (timeDiff / 3600)

      // If speed is suspiciously high (e.g., > 30 km/h in office)
      if (speed > 30) {
        suspiciousMovements++
      }

      totalDistance += distance
    }

    // If multiple suspicious movements detected
    if (suspiciousMovements >= 2) {
      await this.handleSuspiciousMovement(totalDistance)
    }
  }

  private async handleSuspiciousMovement(totalDistance: number) {
    if (!this.currentRecord) return

    const attendanceRef = doc(db, 'attendance', this.currentRecord.id)
    await updateDoc(attendanceRef, {
      flags: arrayUnion({
        type: 'location_mismatch',
        description: `Suspicious movement detected (${Math.round(totalDistance)}m in short time)`,
        severity: 'high',
        timestamp: Timestamp.now()
      })
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
} 