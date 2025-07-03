import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import { AttendanceReport } from '@/types/reports'

export async function exportToExcel(report: AttendanceReport, filename: string) {
  const workbook = XLSX.utils.book_new()

  // Summary Sheet
  const summaryData = [
    ['Attendance Summary Report'],
    ['Generated:', new Date().toLocaleString()],
    [''],
    ['Period:', `${report.dateRange.from.toLocaleDateString()} - ${report.dateRange.to.toLocaleDateString()}`],
    ['Employee:', report.employee?.name || 'All Employees'],
    [''],
    ['Summary Statistics'],
    ['Total Days:', report.stats.totalDays],
    ['Present Days:', report.stats.presentDays],
    ['Absent Days:', report.stats.absentDays],
    ['Late Days:', report.stats.lateDays],
    ['Early Departures:', report.stats.earlyLeaveDays],
    ['Average Hours:', report.stats.averageHours.toFixed(2)],
    [''],
    ['Breakdown by Day'],
    ...report.records.map(record => [
      record.date.toLocaleDateString(),
      record.status,
      record.checkIn ? record.checkIn.time.toLocaleTimeString() : 'N/A',
      record.checkOut ? record.checkOut.time.toLocaleTimeString() : 'N/A',
      (record.checkIn && record.checkOut) 
        ? ((record.checkOut.time.getTime() - record.checkIn.time.getTime()) / (1000 * 60 * 60)).toFixed(2)
        : 'N/A',
      record.notes || ''
    ])
  ]

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')

  // Detailed Sheet
  const detailedData = report.records.map(record => ({
    Date: record.date.toLocaleDateString(),
    Status: record.status,
    'Check In': record.checkIn ? record.checkIn.time.toLocaleTimeString() : 'N/A',
    'Check Out': record.checkOut ? record.checkOut.time.toLocaleTimeString() : 'N/A',
    'Hours Worked': (record.checkIn && record.checkOut) 
      ? ((record.checkOut.time.getTime() - record.checkIn.time.getTime()) / (1000 * 60 * 60)).toFixed(2)
      : 'N/A',
    'Break Duration': record.breaks?.reduce((total, breakTime) => total + (breakTime.duration || 0), 0)?.toFixed(2) || 'N/A',
    'Idle Time': record.idleTime?.reduce((total, idle) => total + idle.duration, 0)?.toFixed(2) || 'N/A',
    Location: record.checkIn?.location?.address || 'N/A',
    Notes: record.notes || ''
  }))

  const detailedSheet = XLSX.utils.json_to_sheet(detailedData)
  XLSX.utils.book_append_sheet(workbook, detailedSheet, 'Detailed')

  // Save the file
  XLSX.writeFile(workbook, `${filename}.xlsx`)
}

export async function exportToPDF(report: AttendanceReport, filename: string) {
  const doc = new jsPDF()

  // Title
  doc.setFontSize(20)
  doc.text('Attendance Report', 14, 15)

  // Report Info
  doc.setFontSize(10)
  doc.text([
    `Generated: ${new Date().toLocaleString()}`,
    `Period: ${report.dateRange.from.toLocaleDateString()} - ${report.dateRange.to.toLocaleDateString()}`,
    `Employee: ${report.employee?.name || 'All Employees'}`
  ], 14, 25)

  // Summary Statistics
  doc.setFontSize(12)
  doc.text('Summary Statistics', 14, 45)
  doc.setFontSize(10)
  doc.text([
    `Total Days: ${report.stats.totalDays}`,
    `Present Days: ${report.stats.presentDays}`,
    `Absent Days: ${report.stats.absentDays}`,
    `Late Days: ${report.stats.lateDays}`,
    `Early Departures: ${report.stats.earlyLeaveDays}`,
    `Average Hours: ${report.stats.averageHours.toFixed(2)}`
  ], 14, 55)

  // Detailed Records Table
  doc.setFontSize(12)
  doc.text('Detailed Records', 14, 95)

  const tableData = report.records.map(record => [
    record.date.toLocaleDateString(),
    record.status,
    record.checkIn ? record.checkIn.time.toLocaleTimeString() : 'N/A',
    record.checkOut ? record.checkOut.time.toLocaleTimeString() : 'N/A',
    (record.checkIn && record.checkOut) 
      ? ((record.checkOut.time.getTime() - record.checkIn.time.getTime()) / (1000 * 60 * 60)).toFixed(2)
      : 'N/A',
    record.notes || ''
  ])

  ;(doc as any).autoTable({
    startY: 100,
    head: [['Date', 'Status', 'Check In', 'Check Out', 'Hours', 'Notes']],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 8 },
    headStyles: { fillColor: [41, 128, 185] }
  })

  // Save the file
  doc.save(`${filename}.pdf`)
} 