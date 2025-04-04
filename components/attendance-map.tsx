'use client'
import { useEffect, useRef, useState } from "react"
import { MapPin } from "lucide-react"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs } from "firebase/firestore"
import type { FirebaseAttendance } from "@/types/database"

// Import Google Maps types
import { Loader } from "@googlemaps/js-api-loader"

declare global {
  interface Window {
    google: {
      maps: {
        Map: new (element: HTMLElement, options: any) => any;
        Marker: new (options: any) => any;
        LatLngBounds: new () => any;
      }
    }
  }
}

interface AttendanceMapProps {
  date: Date
}

export function AttendanceMap({ date }: AttendanceMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [attendance, setAttendance] = useState<FirebaseAttendance[]>([])
  const [loading, setLoading] = useState(true)
  const [mapLoaded, setMapLoaded] = useState(false)

  useEffect(() => {
    const loader = new Loader({
      apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
      version: "weekly",
    })

    loader.load().then(() => {
      setMapLoaded(true)
    })
  }, [])

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const startOfDay = new Date(date)
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(date)
        endOfDay.setHours(23, 59, 59, 999)

        const q = query(
          collection(db, "attendance"),
          where("date", ">=", startOfDay),
          where("date", "<=", endOfDay)
        )

        const querySnapshot = await getDocs(q)
        const attendanceList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as FirebaseAttendance[]

        setAttendance(attendanceList)
      } catch (error) {
        console.error("Error fetching attendance:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchAttendance()
  }, [date])

  useEffect(() => {
    if (!mapRef.current || !mapLoaded || attendance.length === 0) return

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: 0, lng: 0 },
      zoom: 2,
    })

    // Add markers for each attendance record
    attendance.forEach(record => {
      if (!record.checkIn?.location) return

      new window.google.maps.Marker({
        position: {
          lat: record.checkIn.location.latitude,
          lng: record.checkIn.location.longitude,
        },
        map,
        title: record.userId,
        icon: {
          path: MapPin.toString(),
          fillColor: record.status === "present" ? "#22c55e" : 
                    record.status === "late" ? "#eab308" : "#ef4444",
          fillOpacity: 1,
          strokeWeight: 1,
          strokeColor: "#ffffff",
          scale: 1.5,
        },
      })
    })

    // Fit bounds to show all markers
    const bounds = new window.google.maps.LatLngBounds()
    attendance.forEach(record => {
      if (!record.checkIn?.location) return
      bounds.extend({
        lat: record.checkIn.location.latitude,
        lng: record.checkIn.location.longitude,
      })
    })
    map.fitBounds(bounds)
  }, [attendance, mapLoaded])

  if (loading || !mapLoaded) {
    return <div className="text-center py-4">Loading map data...</div>
  }

  return (
    <div className="h-[600px] w-full rounded-lg overflow-hidden">
      <div ref={mapRef} className="w-full h-full" />
    </div>
  )
} 