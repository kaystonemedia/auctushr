'use client'

import { useState, useEffect, useCallback } from 'react'
import { useNewAuth } from '@/contexts/new-auth-context'
import { AttendanceRecord } from '@/types/attendance'
import { Users, Clock, MapPin, AlertCircle } from 'lucide-react'

interface TeamMember {
  id: string
  name: string
  department: string
  attendance: AttendanceRecord | null
  status: 'present' | 'absent' | 'late' | 'early_leave' | 'half_day'
}

export function TeamAttendanceOverview() {
  const { user } = useNewAuth()
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadTeam = useCallback(async () => {
    if (!user?.id) return
    try {
      setLoading(true)
      setError(null)

      const [empRes, attRes] = await Promise.all([
        fetch('/api/employees', { credentials: 'include' }),
        fetch(`/api/attendance/records?date=${new Date().toISOString().slice(0, 10)}`, {
          credentials: 'include',
        }),
      ])

      if (!empRes.ok) throw new Error('Failed to load team')
      if (!attRes.ok) throw new Error('Failed to load attendance')

      const empData = await empRes.json()
      const attData = await attRes.json()
      const todayRecords = (attData.records || []) as AttendanceRecord[]

      const members: TeamMember[] = (empData.employees || []).map(
        (e: { id: string; firstName: string; lastName: string; department: string }) => {
          const attendance = todayRecords.find((r) => r.employeeId === e.id) || null
          let status: TeamMember['status'] = 'absent'
          if (attendance) {
            const s = attendance.status as TeamMember['status']
            if (['present', 'late', 'early_leave', 'half_day'].includes(s)) {
              status = s
            }
          }
          return {
            id: e.id,
            name: `${e.firstName || ''} ${e.lastName || ''}`.trim() || 'Unknown',
            department: e.department || 'Unassigned',
            attendance,
            status,
          }
        }
      )

      setTeamMembers(members)
    } catch (err) {
      console.error('Team attendance error:', err)
      setError('Failed to load team attendance')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadTeam()
    const interval = setInterval(loadTeam, 60_000)
    return () => clearInterval(interval)
  }, [loadTeam])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 text-red-600 bg-red-50 rounded-lg">
        <AlertCircle className="h-5 w-5" />
        <span>{error}</span>
      </div>
    )
  }

  const presentCount = teamMembers.filter((m) =>
    ['present', 'late', 'early_leave', 'half_day'].includes(m.status)
  ).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Users className="h-5 w-5" />
          Team Attendance Today
        </h2>
        <span className="text-sm text-gray-500">
          {presentCount} / {teamMembers.length} present
        </span>
      </div>

      <div className="grid gap-3">
        {teamMembers.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between p-4 bg-white border rounded-lg"
          >
            <div>
              <p className="font-medium">{member.name}</p>
              <p className="text-sm text-gray-500">{member.department}</p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              {member.attendance?.checkIn && (
                <span className="flex items-center gap-1 text-gray-600">
                  <Clock className="h-4 w-4" />
                  {new Date(member.attendance.checkIn.time).toLocaleTimeString()}
                </span>
              )}
              {member.attendance?.checkIn?.location && (
                <span className="flex items-center gap-1 text-gray-500">
                  <MapPin className="h-4 w-4" />
                  On-site
                </span>
              )}
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
                  member.status === 'present'
                    ? 'bg-green-100 text-green-800'
                    : member.status === 'late'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {member.status.replace('_', ' ')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
