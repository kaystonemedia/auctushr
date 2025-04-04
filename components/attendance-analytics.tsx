'use client'

import { useState } from 'react'
import { AttendanceRecord } from '@/types/attendance'
import { BarChart3, Calendar, Clock, Users } from 'lucide-react'

interface AttendanceAnalyticsProps {
  records: AttendanceRecord[]
  period: 'daily' | 'weekly' | 'monthly'
  onPeriodChange: (period: 'daily' | 'weekly' | 'monthly') => void
}

export function AttendanceAnalytics({ records, period, onPeriodChange }: AttendanceAnalyticsProps) {
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'year'>('week')

  // Calculate attendance statistics
  const stats = {
    totalEmployees: records.length,
    present: records.filter(r => r.status === 'present').length,
    late: records.filter(r => r.status === 'late').length,
    absent: records.filter(r => r.status === 'absent').length,
    averageHours: records.reduce((acc, record) => {
      if (record.checkOut) {
        const hours = (new Date(record.checkOut.time).getTime() - new Date(record.checkIn.time).getTime()) / (1000 * 60 * 60)
        return acc + hours
      }
      return acc
    }, 0) / records.filter(r => r.checkOut).length || 0
  }

  // Calculate attendance by department
  const departmentStats = records.reduce((acc, record) => {
    const department = record.department || 'Unassigned'
    if (!acc[department]) {
      acc[department] = {
        total: 0,
        present: 0,
        late: 0,
        absent: 0,
        early_leave: 0,
        half_day: 0
      }
    }
    acc[department].total++
    acc[department][record.status]++
    return acc
  }, {} as Record<string, { 
    total: number; 
    present: number; 
    late: number; 
    absent: number;
    early_leave: number;
    half_day: number;
  }>)

  // Sort departments by total attendance
  const sortedDepartments = Object.entries(departmentStats)
    .sort(([, a], [, b]) => b.total - a.total)

  // Calculate attendance trends
  const trends = records.reduce((acc, record) => {
    const date = new Date(record.date).toLocaleDateString()
    if (!acc[date]) {
      acc[date] = {
        total: 0,
        present: 0,
        late: 0,
        absent: 0,
        early_leave: 0,
        half_day: 0
      }
    }
    acc[date].total++
    acc[date][record.status]++
    return acc
  }, {} as Record<string, { 
    total: number; 
    present: number; 
    late: number; 
    absent: number;
    early_leave: number;
    half_day: number;
  }>)

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Employees</p>
              <p className="text-2xl font-semibold">{stats.totalEmployees}</p>
            </div>
            <Users className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Present Today</p>
              <p className="text-2xl font-semibold">{stats.present}</p>
            </div>
            <Calendar className="h-8 w-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Late Arrivals</p>
              <p className="text-2xl font-semibold">{stats.late}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Average Hours</p>
              <p className="text-2xl font-semibold">{stats.averageHours.toFixed(1)}</p>
            </div>
            <BarChart3 className="h-8 w-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Department-wise Attendance */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">Department-wise Attendance</h3>
        <div className="space-y-4">
          {sortedDepartments.map(([dept, data]) => (
            <div key={dept} className="flex items-center">
              <div className="w-32 text-sm text-gray-600">{dept}</div>
              <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="bg-blue-500 h-full"
                  style={{ width: `${(data.present / data.total) * 100}%` }}
                ></div>
              </div>
              <div className="w-16 text-sm text-gray-600 text-right">
                {Math.round((data.present / data.total) * 100)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Attendance Trends */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Attendance Trends</h3>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as 'week' | 'month' | 'year')}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
          >
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
            <option value="year">Last Year</option>
          </select>
        </div>
        <div className="space-y-4">
          {Object.entries(trends).map(([date, data]) => (
            <div key={date} className="flex items-center">
              <div className="w-32 text-sm text-gray-600">{date}</div>
              <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="bg-green-500 h-full"
                  style={{ width: `${(data.present / data.total) * 100}%` }}
                ></div>
              </div>
              <div className="w-16 text-sm text-gray-600 text-right">
                {Math.round((data.present / data.total) * 100)}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
} 