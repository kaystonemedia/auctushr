"use client"

import { useEffect, useState } from 'react'
import { AttendanceRecord } from '@/types/attendance'
import { TimesheetReport } from './timesheet-report'
import { formatMinutesToHours, formatHours } from '@/lib/timesheet'
import { format } from 'date-fns'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle } from 'lucide-react'

interface EmployeeAttendanceHistoryProps {
  employeeId: string
  employeeName?: string
}

export function EmployeeAttendanceHistory({ employeeId, employeeName = 'Employee' }: EmployeeAttendanceHistoryProps) {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAttendance = async () => {
      setLoading(true)
      try {
        const from = new Date()
        from.setDate(from.getDate() - 90)
        const params = new URLSearchParams({
          employeeId,
          fromDate: from.toISOString().slice(0, 10),
        })
        const res = await fetch(`/api/attendance/records?${params}`, { credentials: 'include' })
        if (!res.ok) throw new Error('Failed to load attendance')
        const data = await res.json()
        const attendanceRecords = (data.records || []).map((r: AttendanceRecord) => ({
          ...r,
          date: r.date ? new Date(r.date) : new Date(),
          checkIn: r.checkIn
            ? { ...r.checkIn, time: new Date(r.checkIn.time) }
            : undefined,
          checkOut: r.checkOut
            ? { ...r.checkOut, time: new Date(r.checkOut.time) }
            : undefined,
        })) as AttendanceRecord[]
        setRecords(attendanceRecords)
      } catch (error) {
        console.error('Error fetching attendance:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchAttendance()
  }, [employeeId])

  if (loading) return <div className="text-center py-8">Loading attendance...</div>
  if (records.length === 0) return <div className="text-center py-8 text-muted-foreground">No attendance records found.</div>

  return (
    <Tabs defaultValue="table" className="w-full">
      <TabsList>
        <TabsTrigger value="table">Table View</TabsTrigger>
        <TabsTrigger value="timesheet">Timesheet Report</TabsTrigger>
      </TabsList>

      <TabsContent value="table" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Attendance History</CardTitle>
            <CardDescription>Clock in/out times with active and idle time breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Total Hours</TableHead>
                  <TableHead className="text-green-600">Active Time</TableHead>
                  <TableHead className="text-orange-600">Idle Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Approval</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map(record => {
                  const clockIn = record.checkIn ? new Date(record.checkIn.time) : null
                  const clockOut = record.checkOut ? new Date(record.checkOut.time) : null
                  const totalHours = record.totalHours || 0
                  const activeMinutes = record.activeTime || 0
                  const idleMinutes = record.idleTimeTotal || record.idleTime?.reduce((sum, p) => sum + (p.duration || 0), 0) || 0

                  return (
                    <TableRow key={record.id}>
                      <TableCell>{format(new Date(record.date), 'MMM d, yyyy')}</TableCell>
                      <TableCell>{clockIn ? format(clockIn, 'h:mm a') : '—'}</TableCell>
                      <TableCell>{clockOut ? format(clockOut, 'h:mm a') : '—'}</TableCell>
                      <TableCell>{formatHours(totalHours)}</TableCell>
                      <TableCell className="text-green-600">{formatMinutesToHours(activeMinutes)}</TableCell>
                      <TableCell className="text-orange-600">{formatMinutesToHours(idleMinutes)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{record.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {record.approvalStatus === 'approved' ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : record.approvalStatus === 'rejected' ? (
                          <AlertCircle className="h-4 w-4 text-red-600" />
                        ) : (
                          <span className="text-xs text-muted-foreground capitalize">{record.approvalStatus || 'pending'}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="timesheet" className="mt-4">
        <TimesheetReport records={records} employeeName={employeeName} />
      </TabsContent>
    </Tabs>
  )
}
