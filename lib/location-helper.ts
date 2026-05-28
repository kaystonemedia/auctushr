/**
 * Helper function to get general location (city/country) from coordinates
 * Uses reverse geocoding to get city and country name
 */
export async function getGeneralLocation(
  latitude: number,
  longitude: number
): Promise<{ city: string; country: string; generalLocation: string }> {
  try {
    // Use OpenStreetMap Nominatim API (free, no API key required)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'Auctushr Attendance System' // Required by Nominatim
        }
      }
    )

    if (!response.ok) {
      throw new Error('Failed to fetch location data')
    }

    const data = await response.json()
    
    const address = data.address || {}
    const city = address.city || address.town || address.village || address.county || 'Unknown'
    const country = address.country || 'Unknown'
    
    // Create general location string (e.g., "Accra, Ghana" or "New York, United States")
    const generalLocation = `${city}, ${country}`

    return {
      city,
      country,
      generalLocation
    }
  } catch (error) {
    console.error('Error getting general location:', error)
    // Return fallback values
    return {
      city: 'Unknown',
      country: 'Unknown',
      generalLocation: 'Location unavailable'
    }
  }
}

/**
 * Simplified location capture - just gets coordinates and general location
 * No validation, just capture what we can
 */
export async function captureLocation(): Promise<{
  latitude: number
  longitude: number
  accuracy: number
  generalLocation?: string
  city?: string
  country?: string
} | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn('Geolocation not supported')
      resolve(null)
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords
        
        // Get general location (city/country) - don't block if it fails
        let generalLocation: string | undefined
        let city: string | undefined
        let country: string | undefined
        
        try {
          const locationData = await getGeneralLocation(latitude, longitude)
          generalLocation = locationData.generalLocation
          city = locationData.city
          country = locationData.country
        } catch (error) {
          console.warn('Could not get general location, but coordinates captured:', error)
        }

        resolve({
          latitude,
          longitude,
          accuracy: accuracy || 0,
          generalLocation,
          city,
          country
        })
      },
      (error) => {
        console.warn('Location capture failed:', error)
        resolve(null)
      },
      {
        enableHighAccuracy: false, // Don't require high accuracy
        timeout: 10000, // 10 second timeout
        maximumAge: 300000 // Accept cached location up to 5 minutes old
      }
    )
  })
}

