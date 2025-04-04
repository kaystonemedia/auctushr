'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { ArrowUpDown } from 'lucide-react'

export type AttendanceRecord = {
  id: string
  employeeId: string
  employeeName: string
  date: string
  checkIn: string
  checkOut: string | null
  status: 'present' | 'absent' | 'late' | 'early_leave' | 'half_day'
  location: string
  notes?: string
  department?: string
  approvalStatus?: 'pending' | 'approved' | 'rejected'
  createdAt?: string
  updatedAt?: string
}

export const columns: ColumnDef<AttendanceRecord>[] = [
  {
    accessorKey: 'employeeName',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Employee
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
  },
  {
    accessorKey: 'date',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
  },
  {
    accessorKey: 'checkIn',
    header: 'Check In',
  },
  {
    accessorKey: 'checkOut',
    header: 'Check Out',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('status') as string
      return (
        <div className={`capitalize ${getStatusColor(status)}`}>
          {status.replace('_', ' ')}
        </div>
      )
    },
  },
  {
    accessorKey: 'location',
    header: 'Location',
  },
  {
    accessorKey: 'notes',
    header: 'Notes',
  },
]

function getStatusColor(status: string): string {
  switch (status) {
    case 'present':
      return 'text-green-600'
    case 'absent':
      return 'text-red-600'
    case 'late':
      return 'text-yellow-600'
    case 'early_leave':
      return 'text-orange-600'
    case 'half_day':
      return 'text-yellow-600'
    default:
      return ''
  }
} 