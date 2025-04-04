'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, onSnapshot, Timestamp } from 'firebase/firestore'
import { AttendanceRecord } from '@/types/attendance'
import { Users, Clock, MapPin, AlertCircle } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface TeamMember {
  id: string
  name: string
  department: string
  attendance: AttendanceRecord | null
  status: 'present' | 'absent' | 'late' | 'early_leave' | 'half_day'
}

export function TeamAttendanceOverview() {
  const { user } = useAuth()
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return

    const fetchTeamMembers = async () => {
      try {
        // Get team members from users collection
        const usersRef = collection(db, 'users')
        const teamQuery = query(usersRef, where('managerId', '==', user.id))
        const teamSnapshot = await getDocs(teamQuery)

        const members: TeamMember[] = []
        for (const doc of teamSnapshot.docs) {
          const userData = doc.data()
          members.push({
            id: doc.id,
            name: userData.name,
            department: userData.department,
            attendance: null,
            status: 'absent'
          })
        }

        // Get today's attendance for all team members
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const attendanceRef = collection(db, 'attendance')
        const attendanceQuery = query(
          attendanceRef,
          where('date', '>=', today)
        )
        const attendanceSnapshot = await getDocs(attendanceQuery)

        // Update team members with attendance data
        const updatedMembers = members.map(member => {
          const attendance = attendanceSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord))
            .find(record => record.employeeId === member.id)

          return {
            ...member,
            attendance: attendance || null,
            status: attendance?.status || 'absent'
          }
        })

        setTeamMembers(updatedMembers)
      } catch (error) {
        console.error('Error fetching team members:', error)
        setError('Failed to load team attendance data')
        toast.error('Failed to load team attendance data')
      } finally {
        setLoading(false)
      }
    }

    fetchTeamMembers()

    // Subscribe to real-time attendance updates
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const attendanceRef = collection(db, 'attendance')
    const attendanceQuery = query(
      attendanceRef,
      where('date', '>=', today)
    )

    const unsubscribe = onSnapshot(attendanceQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const attendance = { id: change.doc.id, ...change.doc.data() } as AttendanceRecord
          setTeamMembers(prev => 
            prev.map(member => 
              member.id === attendance.employeeId
                ? { ...member, attendance, status: attendance.status }
                : member
            )
          )
        }
      })
    })

    return () => unsubscribe()
  }, [user])

  const getStatusColor = (status: TeamMember['status']) => {
    switch (status) {
      case 'present':
        return 'text-green-600 bg-green-50'
      case 'late':
        return 'text-yellow-600 bg-yellow-50'
      case 'early_leave':
        return 'text-orange-600 bg-orange-50'
      case 'half_day':
        return 'text-blue-600 bg-blue-50'
      case 'absent':
        return 'text-red-600 bg-red-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-md">
        {error}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Users className="h-6 w-6 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Team Attendance</h2>
          </div>
          <div className="text-sm text-gray-500">
            {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>

      <div className="divide-y divide-gray-200">
        {teamMembers.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No team members found
          </div>
        ) : (
          teamMembers.map((member) => (
            <div key={member.id} className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                      <span className="text-gray-600 font-medium">
                        {member.name.charAt(0)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{member.name}</p>
                    <p className="text-sm text-gray-500">{member.department}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  {/* Status Badge */}
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(member.status)}`}>
                    {member.status.replace('_', ' ')}
                  </span>

                  {/* Attendance Details */}
                  {member.attendance && (
                    <div className="flex items-center space-x-4">
                      {member.attendance.checkIn && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Clock className="h-4 w-4 mr-1" />
                          <span>
                            {new Date(member.attendance.checkIn.time).toLocaleTimeString()}
                          </span>
                        </div>
                      )}

                      {member.attendance.checkIn?.location && (
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPin className="h-4 w-4 mr-1" />
                          <span>Office</span>
                        </div>
                      )}

                      {member.attendance.flags?.some(flag => flag.severity === 'high') && (
                        <div className="flex items-center text-sm text-red-600">
                          <AlertCircle className="h-4 w-4 mr-1" />
                          <span>High Priority Flag</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
} 