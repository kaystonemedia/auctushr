'use client'

import { useEffect, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Loader2 } from 'lucide-react'
import { ProductivityService } from '@/lib/productivity-service'

interface OverviewMember {
  id: string
  name: string
  email: string
  role: 'manager' | 'employee'
  status: 'active' | 'inactive'
  lastLoginAt?: Date
  lastLogoutAt?: Date
  idleTime?: number // in minutes
  productivityScore?: number
  managerName?: string
}

interface OverviewTableProps {
  viewType: 'all' | 'managers' | 'employees'
}

export function OverviewTable({ viewType }: OverviewTableProps) {
  const [members, setMembers] = useState<OverviewMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/employees', { credentials: 'include' })
        if (!response.ok) throw new Error('Failed to load employees')
        const payload = await response.json()
        const people = (payload.employees || []) as Array<{
          id: string
          uid?: string | null
          firstName?: string
          lastName?: string
          email?: string
          role?: string
          status?: 'active' | 'inactive'
          managerId?: string | null
          updatedAt?: string | Date
        }>
        const byId = new Map(people.map((person) => [person.id, person]))
        const productivityService = ProductivityService.getInstance()
        const todayParam = new Date().toISOString().slice(0, 10)

        const selected = people.filter((person) => {
          if (viewType === 'managers') return person.role === 'manager'
          if (viewType === 'employees') return person.role === 'employee'
          return person.role === 'manager' || person.role === 'employee'
        })

        const mappedMembers = await Promise.all(
          selected.map(async (person) => {
            const memberId = person.uid || person.id
            let productivityScore = 0
            let idleTime = 0

            try {
              const endDate = new Date()
              const startDate = new Date()
              startDate.setDate(startDate.getDate() - 30)
              const analytics = await productivityService.calculateProductivityAnalytics(memberId, startDate, endDate)
              productivityScore = Math.round(analytics.overview.averageProductivityScore)
            } catch (error) {
              console.error('Error fetching productivity:', error)
            }

            try {
              const attendanceResponse = await fetch(
                `/api/attendance/records?employeeId=${encodeURIComponent(memberId)}&date=${todayParam}`,
                { credentials: 'include' }
              )
              if (attendanceResponse.ok) {
                const attendancePayload = await attendanceResponse.json()
                const firstRecord = (attendancePayload.records || [])[0] as { idleTimeMinutes?: number } | undefined
                idleTime = Math.round(firstRecord?.idleTimeMinutes || 0)
              }
            } catch (error) {
              console.error('Error fetching idle time:', error)
            }

            const managerProfile = person.managerId ? byId.get(person.managerId) : undefined
            const managerName = managerProfile
              ? `${managerProfile.firstName || ''} ${managerProfile.lastName || ''}`.trim() || managerProfile.email || 'Unknown'
              : 'N/A'

            return {
              id: memberId,
              name: `${person.firstName || ''} ${person.lastName || ''}`.trim() || 'Unknown',
              email: person.email || '',
              role: person.role === 'manager' ? 'manager' : 'employee',
              status: person.status === 'inactive' ? 'inactive' : 'active',
              lastLoginAt: person.updatedAt ? new Date(person.updatedAt) : undefined,
              lastLogoutAt: undefined,
              idleTime,
              productivityScore,
              managerName
            } as OverviewMember
          })
        )

        setMembers(mappedMembers)
      } catch (error) {
        console.error('Error fetching overview data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [viewType])

  const formatTime = (date?: Date) => {
    if (!date) return 'N/A'
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    })
  }

  const formatDate = (date?: Date) => {
    if (!date) return 'N/A'
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            {viewType === 'employees' && <TableHead>Manager</TableHead>}
            <TableHead>Status</TableHead>
            <TableHead>Login Time</TableHead>
            <TableHead>Logout Time</TableHead>
            <TableHead>Idle Time</TableHead>
            <TableHead>Productivity Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.length === 0 ? (
            <TableRow>
              <TableCell colSpan={viewType === 'employees' ? 9 : 8} className="text-center py-8 text-muted-foreground">
                No data found
              </TableCell>
            </TableRow>
          ) : (
            members.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">{member.name}</TableCell>
                <TableCell>{member.email}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {member.role}
                  </Badge>
                </TableCell>
                {viewType === 'employees' && (
                  <TableCell>{member.managerName || 'N/A'}</TableCell>
                )}
                <TableCell>
                  <Badge
                    variant={member.status === 'active' ? 'default' : 'secondary'}
                    className={
                      member.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }
                  >
                    {member.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <div>{formatTime(member.lastLoginAt)}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(member.lastLoginAt)}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <div>{formatTime(member.lastLogoutAt)}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(member.lastLogoutAt)}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {member.idleTime !== undefined ? `${member.idleTime} min` : 'N/A'}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{member.productivityScore || 0}%</span>
                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          (member.productivityScore || 0) >= 80
                            ? 'bg-green-500'
                            : (member.productivityScore || 0) >= 60
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(member.productivityScore || 0, 100)}%` }}
                      />
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}










