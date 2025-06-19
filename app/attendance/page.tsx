'use client'

import { useState, useEffect } from 'react'
import { Filter, Clock, MapPin, User, AlertCircle } from "lucide-react"
import { AttendanceRecord, AttendanceStats, AttendanceFilters, AttendanceNotification } from "@/types/attendance"
import { useNewAuth } from "@/contexts/new-auth-context"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs, addDoc, updateDoc, doc, Timestamp, orderBy, onSnapshot } from "firebase/firestore"
import { toast } from "react-hot-toast"
import { detectIdleTime, calculateAttendanceStats, startIdleTimeTracking } from "@/lib/attendance"
import { AttendanceDetails } from "@/components/attendance-details"
import { AttendanceCheckIn } from '@/components/attendance-check-in'
import { AttendanceTableMobile } from '@/components/attendance-table-mobile'
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { AttendanceFilterPanel } from "@/components/attendance-filter-panel"
import { AttendanceTable } from '@/components/attendance-table'
import { Calendar } from "@/components/ui/calendar"
import { AttendanceCheckOut } from '@/components/attendance-check-out'
import { TeamAttendanceOverview } from '@/components/team-attendance-overview'
import { settingsService } from '@/lib/settings'
import { Settings } from '@/types/settings'

export default function AttendancePage() {
  const { user, firebaseUser, isLoading: authLoading } = useNewAuth()
  const [todayRecord, setTodayRecord] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [stats, setStats] = useState<AttendanceStats>({
    totalDays: 0,
    presentDays: 0,
    absentDays: 0,
    lateDays: 0,
    earlyLeaveDays: 0,
    halfDays: 0,
    attendanceRate: 0,
    averageIdleTime: 0,
    flags: {
      count: 0,
      byType: {
        irregular_hours: 0,
        multiple_idle_periods: 0,
        location_mismatch: 0,
        device_change: 0
      }
    },
    approvalStats: {
      approved: 0,
      rejected: 0,
      pending: 0
    },
    averageHours: 0,
    overtimeHours: 0,
    pendingApprovals: 0
  })
  const [filters, setFilters] = useState<AttendanceFilters>({})
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [departments, setDepartments] = useState<string[]>([])
  const [isIdle, setIsIdle] = useState(false)
  const [idlePeriods, setIdlePeriods] = useState<{ startTime: Date; endTime: Date }[]>([])
  const [locationPermission, setLocationPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt')
  const [extensionStatus, setExtensionStatus] = useState<{
    installed: boolean;
    active: boolean;
    tracking: boolean;
  }>({
    installed: false,
    active: false,
    tracking: false
  })

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const currentSettings = await settingsService.getSettings()
      setSettings(currentSettings)
    } catch (error) {
      console.error('Error loading settings:', error)
      toast.error('Failed to load settings')
    }
  }

  useEffect(() => {
    if (!firebaseUser?.uid) {
      setLoading(false)
      return
    }

    let q = query(
      collection(db, "attendance"),
      orderBy("date", "desc")
    )

    if (user && user.role !== 'admin') {
      q = query(q, where("employeeId", "==", firebaseUser.uid))
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const recordsList = snapshot.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate() || new Date(),
          checkIn: {
            ...data.checkIn,
            time: data.checkIn?.time?.toDate() || new Date(),
            location: data.checkIn?.location || null,
            deviceInfo: data.checkIn?.deviceInfo || null
          },
          checkOut: data.checkOut ? {
            ...data.checkOut,
            time: data.checkOut.time?.toDate() || new Date(),
            location: data.checkOut.location || null,
            deviceInfo: data.checkOut.deviceInfo || null
          } : undefined
        }
      }) as AttendanceRecord[]
      setAttendanceRecords(recordsList)
      setStats(calculateAttendanceStats(recordsList))
      setLoading(false)
    }, (error) => {
      console.error("Error fetching attendance records:", error)
      toast.error("Failed to fetch attendance records")
      setLoading(false)
    })

    return () => unsubscribe()
  }, [firebaseUser?.uid, user?.role])

  useEffect(() => {
    if (!firebaseUser?.uid) {
      setLoading(false)
      return
    }

    fetchTodayRecord()
    fetchAttendanceRecords()
    fetchDepartments()
  }, [filters, firebaseUser?.uid])

  useEffect(() => {
    if (!user || !todayRecord || todayRecord.checkOut || !settings) return

    // Start idle time tracking with settings
    const attendanceSettings = {
      workingHours: {
        start: settings.attendance.checkInTime,
        end: settings.attendance.checkOutTime
      },
      idleThreshold: settings.productivity.idleThreshold,
      maxIdlePeriods: 3,
      allowedLateMinutes: settings.attendance.lateThreshold,
      locationRadius: settings.attendance.maxDistance,
      requiredCheckInDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      requireManagerApproval: true,
      autoApproveThreshold: 30
    }

    const cleanup = startIdleTimeTracking(
      (startTime) => {
        setIsIdle(true)
        setIdlePeriods(prev => [...prev, { startTime, endTime: new Date() }])
      },
      (startTime, endTime) => {
        setIsIdle(false)
        setIdlePeriods(prev => 
          prev.map(period => 
            period.startTime === startTime 
              ? { ...period, endTime } 
              : period
          )
        )
      },
      attendanceSettings
    )

    return cleanup
  }, [user, todayRecord, settings])

  // Update attendance record with idle time
  useEffect(() => {
    if (!todayRecord || !idlePeriods.length || !settings) return

    const updateRecord = async () => {
      try {
        const recordRef = doc(db, 'attendance', todayRecord.id)
        const attendanceSettings = {
          workingHours: {
            start: settings.attendance.checkInTime,
            end: settings.attendance.checkOutTime
          },
          idleThreshold: settings.productivity.idleThreshold,
          maxIdlePeriods: 3,
          allowedLateMinutes: settings.attendance.lateThreshold,
          locationRadius: settings.attendance.maxDistance,
          requiredCheckInDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          requireManagerApproval: true,
          autoApproveThreshold: 30
        }

        const updatedRecord = detectIdleTime({
          ...todayRecord,
          idleTime: idlePeriods.map(period => ({
            startTime: period.startTime,
            endTime: period.endTime,
            duration: (period.endTime.getTime() - period.startTime.getTime()) / (1000 * 60) // in minutes
          }))
        }, attendanceSettings)

        await updateDoc(recordRef, {
          idleTime: updatedRecord.idleTime,
          flags: updatedRecord.flags,
          status: updatedRecord.status,
          updatedAt: new Date()
        })
      } catch (error) {
        console.error('Error updating idle time:', error)
        toast.error('Failed to update idle time')
      }
    }

    updateRecord()
  }, [todayRecord, idlePeriods, settings])

  const getDeviceInfo = () => {
    return {
      browser: navigator.userAgent,
      os: navigator.platform,
      ip: '' // Would need a backend service to get IP
    }
  }

  const fetchTodayRecord = async () => {
    if (!firebaseUser?.uid) return

    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('employeeId', '==', firebaseUser.uid),
        where('date', '==', Timestamp.fromDate(today))
      )
      const attendanceSnapshot = await getDocs(attendanceQuery)

      if (!attendanceSnapshot.empty) {
        const data = attendanceSnapshot.docs[0].data()
        setTodayRecord({
          id: attendanceSnapshot.docs[0].id,
          ...data,
          date: data.date?.toDate() || new Date(),
          checkIn: {
            ...data.checkIn,
            time: data.checkIn?.time?.toDate() || new Date(),
            location: data.checkIn?.location || null,
            deviceInfo: data.checkIn?.deviceInfo || null
          },
          checkOut: data.checkOut ? {
            ...data.checkOut,
            time: data.checkOut.time?.toDate() || new Date(),
            location: data.checkOut.location || null,
            deviceInfo: data.checkOut.deviceInfo || null
          } : undefined
        })
      }
    } catch (error) {
      console.error('Error fetching today\'s record:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAttendanceRecords = async () => {
    if (!firebaseUser?.uid) {
      setLoading(false)
      return
    }

    try {
      let q = query(collection(db, 'attendance'))
      
      if (user && user.role === 'employee') {
        q = query(q, where('employeeId', '==', firebaseUser.uid))
      } else if (user && user.role === 'manager') {
        q = query(q, where('managerId', '==', firebaseUser.uid))
      }
      
      if (filters.startDate) {
        q = query(q, where('date', '>=', Timestamp.fromDate(filters.startDate)))
      }
      
      if (filters.endDate) {
        q = query(q, where('date', '<=', Timestamp.fromDate(filters.endDate)))
      }

      const querySnapshot = await getDocs(q)
      const records = querySnapshot.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate() || new Date(),
          checkIn: {
            ...data.checkIn,
            time: data.checkIn?.time?.toDate() || new Date(),
            location: data.checkIn?.location || null,
            deviceInfo: data.checkIn?.deviceInfo || null
          },
          checkOut: data.checkOut ? {
            ...data.checkOut,
            time: data.checkOut.time?.toDate() || new Date(),
            location: data.checkOut.location || null,
            deviceInfo: data.checkOut.deviceInfo || null
          } : undefined
        }
      }) as AttendanceRecord[]

      setAttendanceRecords(records)
      setStats(calculateAttendanceStats(records))
    } catch (error) {
      console.error('Error fetching attendance records:', error)
      toast.error('Failed to fetch attendance records')
    } finally {
      setLoading(false)
    }
  }

  const fetchDepartments = async () => {
    try {
      // ... existing fetch logic ...
    } catch (error) {
      console.error('Error fetching departments:', error)
    }
  }

  const handleApprove = async (recordId: string, notes?: string) => {
    try {
      const recordRef = doc(db, "attendance", recordId)
      await updateDoc(recordRef, {
        approvalStatus: 'approved',
        approvedBy: user?.id,
        approvedAt: new Date(),
        ...(notes && { approvalNotes: notes })
      })
      toast.success("Attendance record approved")
    } catch (error) {
      console.error("Error approving attendance record:", error)
      toast.error("Failed to approve attendance record")
    }
  }

  const handleReject = async (recordId: string, notes?: string) => {
    try {
      const recordRef = doc(db, "attendance", recordId)
      await updateDoc(recordRef, {
        approvalStatus: 'rejected',
        approvedBy: user?.id,
        approvedAt: new Date(),
        ...(notes && { approvalNotes: notes })
      })
      toast.success("Attendance record rejected")
    } catch (error) {
      console.error("Error rejecting attendance record:", error)
      toast.error("Failed to reject attendance record")
    }
  }

  const handleDateSelect = (day: Date | undefined) => {
    setSelectedDate(day || new Date())
  }

  const handleApplyFilters = (newFilters: AttendanceFilters) => {
    setFilters(newFilters)
    setShowFilterPanel(false)
  }

  const handleClearFilters = () => {
    setFilters({})
    setShowFilterPanel(false)
  }

  const handleSuccess = () => {
    fetchTodayRecord()
    fetchAttendanceRecords()
  }

  // Check extension status
  useEffect(() => {
    const checkExtension = async () => {
      if (typeof window === 'undefined' || typeof chrome === 'undefined' || !chrome.runtime) return;
      try {
        // Check if extension is installed
        const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' })
        setExtensionStatus({
          installed: true,
          active: true,
          tracking: response?.isCheckedIn || false
        })
      } catch (error) {
        // Extension not installed or not responding
        setExtensionStatus({
          installed: false,
          active: false,
          tracking: false
        })
      }
    }

    checkExtension()
  }, [])

  // Check location permission status only
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

  // Handle extension check-in/out
  const handleExtensionCheckIn = async () => {
    try {
      if (!location) {
        toast.error('Location permission required')
        return
      }
      if (typeof window === 'undefined' || typeof chrome === 'undefined' || !chrome.runtime) {
        toast.error('Extension not available in this environment')
        return
      }
      const response = await chrome.runtime.sendMessage({
        type: 'CHECK_IN',
        data: {
          location,
          deviceInfo: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screenResolution: `${window.screen.width}x${window.screen.height}`
          }
        }
      })

      if (response?.error) {
        throw new Error(response.error)
      }

      setExtensionStatus(prev => ({ ...prev, tracking: true }))
      toast.success('Extension check-in successful')
      handleSuccess()
    } catch (error) {
      console.error('Extension check-in error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to check in with extension')
    }
  }

  const handleExtensionCheckOut = async () => {
    try {
      if (typeof window === 'undefined' || typeof chrome === 'undefined' || !chrome.runtime) {
        toast.error('Extension not available in this environment')
        return
      }
      const response = await chrome.runtime.sendMessage({ type: 'CHECK_OUT' })
      
      if (response?.error) {
        throw new Error(response.error)
      }

      setExtensionStatus(prev => ({ ...prev, tracking: false }))
      toast.success('Extension check-out successful')
      handleSuccess()
    } catch (error) {
      console.error('Extension check-out error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to check out with extension')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Attendance</h1>
          <p className="text-sm text-gray-500 mt-1">Track and manage attendance records</p>
        </div>
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            onClick={() => setShowFilterPanel(!showFilterPanel)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>
      </div>

      {/* Location Permission Status */}
      {locationPermission === 'denied' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <MapPin className="h-5 w-5 text-red-500 mr-2" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Location Access Required</h3>
              <p className="text-sm text-red-700 mt-1">
                Please enable location services in your browser settings to use the attendance system.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Extension Status */}
      {!extensionStatus.installed && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800">Extension Not Installed</h3>
              <p className="text-sm text-yellow-700 mt-1">
                Install the StyleTry Attendance Extension to enable activity tracking.
              </p>
              <a
                href="https://chrome.google.com/webstore/detail/styletry-attendance/your-extension-id"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-yellow-800 underline mt-2 inline-block"
              >
                Install Extension
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Today's Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Status</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {extensionStatus.installed && extensionStatus.tracking ? (
              <AttendanceCheckOut
                record={todayRecord}
                onSuccess={handleExtensionCheckOut}
              />
            ) : (
              <AttendanceCheckIn
                location={location}
                onSuccess={handleExtensionCheckIn}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Location</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {location ? 'Location tracked' : 'Location not available'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Idle Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {isIdle ? 'Currently idle' : 'Active'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Overview</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <TeamAttendanceOverview />
          </CardContent>
        </Card>
      </div>

      {/* Filter Panel */}
      {showFilterPanel && (
        <Card>
          <CardContent className="p-6">
            <AttendanceFilterPanel
              isOpen={showFilterPanel}
              onClose={() => setShowFilterPanel(false)}
              currentFilters={filters}
              departments={departments}
              onApply={handleApplyFilters}
              onClear={handleClearFilters}
            />
          </CardContent>
        </Card>
      )}

      {/* Calendar */}
      <Card>
        <CardHeader>
          <CardTitle>Select Date</CardTitle>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={selectedDate || undefined}
            onSelect={handleDateSelect}
            className="rounded-md border"
          />
        </CardContent>
      </Card>

      {/* Attendance Records */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance Records</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="hidden md:block">
            <AttendanceTable
              records={attendanceRecords}
              onApprove={handleApprove}
              onReject={handleReject}
              date={selectedDate}
            />
          </div>
          <div className="md:hidden">
            <AttendanceTableMobile
              records={attendanceRecords}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          </div>
        </CardContent>
      </Card>

      {/* Attendance Details */}
      {selectedDate && (
        <Card>
          <CardHeader>
            <CardTitle>Attendance Details</CardTitle>
          </CardHeader>
          <CardContent>
            <AttendanceDetails
              records={attendanceRecords}
              date={selectedDate}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
} 