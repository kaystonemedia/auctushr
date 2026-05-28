'use client'

import { useState, useEffect } from 'react'
import { Filter, Clock, MapPin, User, AlertCircle } from "lucide-react"
import { AttendanceRecord, AttendanceStats, AttendanceFilters, AttendanceNotification } from "@/types/attendance"
import { useNewAuth } from "@/contexts/new-auth-context"
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
import { settingsClientService } from '@/lib/settings-client'
import { Settings } from '@/types/settings'

export default function AttendancePage() {
  const { user, isLoading: authLoading } = useNewAuth()
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
      const currentSettings = await settingsClientService.getSettings()
      setSettings(currentSettings)
    } catch (error) {
      console.error('Error loading settings:', error)
      toast.error('Failed to load settings')
    }
  }

  const loadAttendanceData = async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filters.startDate) params.set('fromDate', filters.startDate.toISOString().slice(0, 10))
      if (filters.endDate) params.set('toDate', filters.endDate.toISOString().slice(0, 10))
      if (!filters.startDate && !filters.endDate) {
        params.set('date', new Date().toISOString().slice(0, 10))
      }
      if (user.role === 'employee') {
        params.set('employeeId', user.id)
      }

      const res = await fetch(`/api/attendance/records?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load attendance')
      const data = await res.json()
      const recordsList = (data.records || []).map((r: AttendanceRecord) => ({
        ...r,
        date: r.date ? new Date(r.date) : new Date(),
        checkIn: {
          ...r.checkIn,
          time: r.checkIn?.time ? new Date(r.checkIn.time) : new Date(),
        },
        checkOut: r.checkOut
          ? { ...r.checkOut, time: r.checkOut.time ? new Date(r.checkOut.time) : new Date() }
          : undefined,
      })) as AttendanceRecord[]
      setAttendanceRecords(recordsList)
      setStats(calculateAttendanceStats(recordsList))
      setTodayRecord(data.todayRecord || null)
    } catch (error) {
      console.error('Error fetching attendance records:', error)
      toast.error('Failed to fetch attendance records')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading || !user?.id) return
    loadAttendanceData()
    const interval = setInterval(loadAttendanceData, 60_000)
    return () => clearInterval(interval)
  }, [filters, user?.id, user?.role, authLoading])

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
        const attendanceSettings = {
          workingHours: {
            start: settings.attendance.checkInTime,
            end: settings.attendance.checkOutTime
          },
          idleThreshold: settings.productivity.idleThreshold,
          idleTimeSLAThreshold: settings.attendance.idleTimeSLAThreshold || 3,
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

        await fetch(`/api/attendance/records/${todayRecord.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idleTimeMinutes: updatedRecord.idleTimeTotal,
            activeTimeMinutes: updatedRecord.activeTime,
            flags: updatedRecord.flags,
          }),
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

  const handleApprove = async (recordId: string, notes?: string) => {
    try {
      const res = await fetch(`/api/attendance/records/${recordId}/approval`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approved', notes }),
      })
      if (!res.ok) throw new Error('Approval failed')
      toast.success('Attendance record approved')
      await loadAttendanceData()
    } catch (error) {
      console.error('Error approving attendance record:', error)
      toast.error('Failed to approve attendance record')
    }
  }

  const handleReject = async (recordId: string, notes?: string) => {
    try {
      const res = await fetch(`/api/attendance/records/${recordId}/approval`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rejected', notes }),
      })
      if (!res.ok) throw new Error('Rejection failed')
      toast.success('Attendance record rejected')
      await loadAttendanceData()
    } catch (error) {
      console.error('Error rejecting attendance record:', error)
      toast.error('Failed to reject attendance record')
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

  const handleSuccess = async () => {
    setTimeout(() => loadAttendanceData(), 500)
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
                                    Install the KaystoneHR Attendance Extension to enable activity tracking.
              </p>
              <a
                                    href="https://chrome.google.com/webstore/detail/kaystonehr-attendance/your-extension-id"
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
            {todayRecord?.checkIn && !todayRecord?.checkOut ? (
              <AttendanceCheckOut
                record={todayRecord}
                onSuccess={handleSuccess}
              />
            ) : (
              <AttendanceCheckIn
                location={location}
                onSuccess={handleSuccess}
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