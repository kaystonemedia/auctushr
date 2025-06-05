'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { addDays, format } from "date-fns"
import { Download, FileText, BarChart2, Users } from "lucide-react"
import { AttendanceRecord, AttendanceStats } from "@/types/attendance"
import { exportToExcel, exportToPDF } from "@/lib/export"
import { generateAttendanceReport } from "@/lib/reports"

interface AttendanceReportsProps {
  records: AttendanceRecord[]
  stats: AttendanceStats
  employees: Array<{ id: string; name: string }>
}

export function AttendanceReports({ records, stats, employees }: AttendanceReportsProps) {
  const [dateRange, setDateRange] = useState({
    from: new Date(),
    to: addDays(new Date(), 7)
  })
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all')
  const [reportType, setReportType] = useState<'summary' | 'detailed' | 'custom'>('summary')
  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf'>('excel')
  const [generating, setGenerating] = useState(false)

  const handleExport = async () => {
    try {
      setGenerating(true)
      const filteredRecords = records.filter(record => {
        const recordDate = new Date(record.date)
        return (
          recordDate >= dateRange.from &&
          recordDate <= dateRange.to &&
          (selectedEmployee === 'all' || record.employeeId === selectedEmployee)
        )
      })

      const report = await generateAttendanceReport({
        records: filteredRecords,
        stats,
        type: reportType,
        dateRange,
        employee: selectedEmployee === 'all' ? undefined : employees.find(e => e.id === selectedEmployee)
      })

      if (exportFormat === 'excel') {
        await exportToExcel(report, `attendance-report-${format(new Date(), 'yyyy-MM-dd')}`)
      } else {
        await exportToPDF(report, `attendance-report-${format(new Date(), 'yyyy-MM-dd')}`)
      }

      toast.success('Report exported successfully')
    } catch (error) {
      console.error('Error exporting report:', error)
      toast.error('Failed to export report')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Attendance Reports
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Date Range</Label>
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
            />
          </div>
          <div className="space-y-2">
            <Label>Employee</Label>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees.map(employee => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Report Type</Label>
            <Select value={reportType} onValueChange={(v: any) => setReportType(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select report type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="summary">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="h-4 w-4" />
                    Summary Report
                  </div>
                </SelectItem>
                <SelectItem value="detailed">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Detailed Report
                  </div>
                </SelectItem>
                <SelectItem value="custom">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Custom Report
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Export Format</Label>
            <Select value={exportFormat} onValueChange={(v: any) => setExportFormat(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="excel">Excel (.xlsx)</SelectItem>
                <SelectItem value="pdf">PDF (.pdf)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          onClick={handleExport}
          disabled={generating}
          className="w-full"
        >
          {generating ? (
            'Generating Report...'
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Export Report
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
} 