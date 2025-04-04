'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface DateRangePickerProps {
  from: Date
  to: Date
  onSelect: (range: { from: Date; to: Date }) => void
  className?: string
}

export function DateRangePicker({
  from,
  to,
  onSelect,
  className,
}: DateRangePickerProps) {
  const [startDate, setStartDate] = React.useState(
    from.toISOString().split('T')[0]
  )
  const [endDate, setEndDate] = React.useState(to.toISOString().split('T')[0])

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStartDate = e.target.value
    setStartDate(newStartDate)
    onSelect({
      from: new Date(newStartDate),
      to: new Date(endDate),
    })
  }

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEndDate = e.target.value
    setEndDate(newEndDate)
    onSelect({
      from: new Date(startDate),
      to: new Date(newEndDate),
    })
  }

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <div className="flex flex-col gap-1">
        <label htmlFor="start-date" className="text-sm font-medium">
          Start Date
        </label>
        <input
          id="start-date"
          type="date"
          value={startDate}
          onChange={handleStartDateChange}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="end-date" className="text-sm font-medium">
          End Date
        </label>
        <input
          id="end-date"
          type="date"
          value={endDate}
          onChange={handleEndDateChange}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
    </div>
  )
} 