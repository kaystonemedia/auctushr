import { AttendanceRecord } from '@/types/attendance'

export function exportAttendanceToCSV(records: AttendanceRecord[], filename: string = 'attendance-report.csv') {
  // Define CSV headers
  const headers = [
    'Date',
    'Employee Name',
    'Department',
    'Status',
    'Check In Time',
    'Check Out Time',
    'Hours Worked',
    'Location',
    'Flags',
    'Approval Status'
  ]

  // Convert records to CSV rows
  const rows = records.map(record => [
    record.date.toLocaleDateString(),
    record.employeeName,
    record.department,
    record.status,
    record.checkIn.time.toLocaleTimeString(),
    record.checkOut?.time.toLocaleTimeString() || 'Not checked out',
    record.checkOut ? calculateHours(record.checkIn.time, record.checkOut.time) : '-',
    record.checkIn.location ? 'Location recorded' : 'No location',
    record.flags?.length ? record.flags.length + ' flags' : 'No flags',
    record.approvalStatus
  ])

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  // Create and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function calculateHours(checkIn: Date, checkOut: Date): string {
  const diffMs = checkOut.getTime() - checkIn.getTime()
  const hours = diffMs / (1000 * 60 * 60)
  return hours.toFixed(1)
} 