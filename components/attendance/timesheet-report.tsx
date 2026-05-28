"use client"

import { useState, useEffect } from 'react'
import { AttendanceRecord, TimesheetSummary } from '@/types/attendance'
import { generateTimesheetSummary, generateWeeklyTimesheet, generateBiWeeklyTimesheet, formatMinutesToHours, formatHours } from '@/lib/timesheet'
import { format, startOfWeek, addWeeks, subWeeks } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle, Download } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface TimesheetReportProps {
  records: AttendanceRecord[]
  employeeId: string
  employeeName: string
}

export function TimesheetReport({ records, employeeId, employeeName }: TimesheetReportProps) {
  const [periodType, setPeriodType] = useState<'daily' | 'weekly' | 'bi-weekly'>('weekly')
  const [currentPeriod, setCurrentPeriod] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [summary, setSummary] = useState<TimesheetSummary | null>(null)

  useEffect(() => {
    if (!records.length) {
      setSummary(null)
      return
    }

    let newSummary: TimesheetSummary

    switch (periodType) {
      case 'daily':
        newSummary = generateTimesheetSummary(
          records,
          employeeId,
          employeeName,
          currentPeriod,
          currentPeriod,
          'daily'
        )
        break
      case 'weekly':
        const weekStart = startOfWeek(currentPeriod, { weekStartsOn: 1 })
        newSummary = generateWeeklyTimesheet(records, employeeId, employeeName, weekStart)
        break
      case 'bi-weekly':
        const biWeekStart = startOfWeek(currentPeriod, { weekStartsOn: 1 })
        newSummary = generateBiWeeklyTimesheet(records, employeeId, employeeName, biWeekStart)
        break
      default:
        return
    }

    setSummary(newSummary)
  }, [records, employeeId, employeeName, periodType, currentPeriod])

  const handlePreviousPeriod = () => {
    if (periodType === 'daily') {
      setCurrentPeriod(new Date(currentPeriod.getTime() - 24 * 60 * 60 * 1000))
    } else if (periodType === 'weekly') {
      setCurrentPeriod(subWeeks(currentPeriod, 1))
    } else {
      setCurrentPeriod(subWeeks(currentPeriod, 2))
    }
  }

  const handleNextPeriod = () => {
    if (periodType === 'daily') {
      setCurrentPeriod(new Date(currentPeriod.getTime() + 24 * 60 * 60 * 1000))
    } else if (periodType === 'weekly') {
      setCurrentPeriod(addWeeks(currentPeriod, 1))
    } else {
      setCurrentPeriod(addWeeks(currentPeriod, 2))
    }
  }

  const handleExport = () => {
    if (!summary) return

    // Create CSV content
    const headers = ['Date', 'Clock In', 'Clock Out', 'Total Hours', 'Active Time', 'Idle Time', 'Status', 'Approval Status']
    const rows = summary.breakdown.map(day => [
      format(day.date, 'yyyy-MM-dd'),
      day.clockIn ? format(day.clockIn, 'HH:mm') : '-',
      day.clockOut ? format(day.clockOut, 'HH:mm') : '-',
      formatHours(day.totalHours),
      formatMinutesToHours(day.activeTime),
      formatMinutesToHours(day.idleTime),
      day.status,
      day.approvalStatus
    ])

    const csvContent = [
      `Timesheet Report - ${employeeName}`,
      `Period: ${format(summary.period.start, 'MMM dd, yyyy')} - ${format(summary.period.end, 'MMM dd, yyyy')}`,
      '',
      'Summary',
      `Total Days: ${summary.totals.totalDays}`,
      `Total Hours: ${formatHours(summary.totals.totalHours)}`,
      `Total Active Time: ${formatMinutesToHours(summary.totals.activeTime)}`,
      `Total Idle Time: ${formatMinutesToHours(summary.totals.idleTime)}`,
      `Average Hours/Day: ${formatHours(summary.totals.averageHoursPerDay)}`,
      '',
      ...headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `timesheet-${employeeName}-${format(summary.period.start, 'yyyy-MM-dd')}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (!summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Timesheet Report</CardTitle>
          <CardDescription>No attendance records found for this period</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const getApprovalBadge = (status: AttendanceRecord['approvalStatus']) => {
    switch (status) {
      case 'approved':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>
      default:
        return <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" />Pending</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Timesheet Report</CardTitle>
            <CardDescription>
              {format(summary.period.start, 'MMM dd, yyyy')} - {format(summary.period.end, 'MMM dd, yyyy')}
            </CardDescription>
          </div>
          <Button onClick={handleExport} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Period Controls */}
        <div className="flex items-center gap-4 mb-6">
          <Select value={periodType} onValueChange={(value: 'daily' | 'weekly' | 'bi-weekly') => setPeriodType(value)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="bi-weekly">Bi-Weekly</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePreviousPeriod}>
              Previous
            </Button>
            <span className="text-sm font-medium min-w-[200px] text-center">
              {periodType === 'daily' 
                ? format(currentPeriod, 'MMM dd, yyyy')
                : `${format(summary.period.start, 'MMM dd')} - ${format(summary.period.end, 'MMM dd, yyyy')}`
              }
            </span>
            <Button variant="outline" size="sm" onClick={handleNextPeriod}>
              Next
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Hours</p>
                  <p className="text-2xl font-bold">{formatHours(summary.totals.totalHours)}</p>
                </div>
                <Clock className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Time</p>
                  <p className="text-2xl font-bold">{formatMinutesToHours(summary.totals.activeTime)}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Idle Time</p>
                  <p className="text-2xl font-bold">{formatMinutesToHours(summary.totals.idleTime)}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Days Worked</p>
                  <p className="text-2xl font-bold">{summary.totals.totalDays}</p>
                </div>
                <Calendar className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Daily Breakdown Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Clock In</TableHead>
                <TableHead>Clock Out</TableHead>
                <TableHead>Total Hours</TableHead>
                <TableHead>Active Time</TableHead>
                <TableHead>Idle Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Approval</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.breakdown.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No records for this period
                  </TableCell>
                </TableRow>
              ) : (
                summary.breakdown.map((day, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">
                      {format(day.date, 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      {day.clockIn ? format(day.clockIn, 'HH:mm') : '-'}
                    </TableCell>
                    <TableCell>
                      {day.clockOut ? format(day.clockOut, 'HH:mm') : '-'}
                    </TableCell>
                    <TableCell>{formatHours(day.totalHours)}</TableCell>
                    <TableCell className="text-green-600 font-medium">
                      {formatMinutesToHours(day.activeTime)}
                    </TableCell>
                    <TableCell className="text-orange-600 font-medium">
                      {formatMinutesToHours(day.idleTime)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{day.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {getApprovalBadge(day.approvalStatus)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Summary Footer */}
        <div className="mt-6 p-4 bg-muted rounded-lg">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Average Hours/Day</p>
              <p className="font-semibold">{formatHours(summary.totals.averageHoursPerDay)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Average Active Time/Day</p>
              <p className="font-semibold">{formatMinutesToHours(summary.totals.averageActiveTimePerDay)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Average Idle Time/Day</p>
              <p className="font-semibold">{formatMinutesToHours(summary.totals.averageIdleTimePerDay)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

