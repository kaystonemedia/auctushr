'use client'

import { useEffect, useState } from 'react'
import { useNewAuth } from '@/contexts/new-auth-context'
import Link from 'next/link'

interface AuditRow {
  id: string
  action: string
  actorId?: string
  actorRole?: string
  targetType?: string
  targetId?: string
  outcome?: 'success' | 'failure'
  message?: string
  createdAt?: any
}

export default function AuditLogsPage() {
  const { user, isLoading } = useNewAuth()
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isLoading) return
    if (!user || user.role !== 'admin') {
      setLoading(false)
      return
    }
    ;(async () => {
      try {
        const res = await fetch('/api/audit-logs?limit=200', { credentials: 'include' })
        if (!res.ok) throw new Error('Failed to load audit logs')
        const data = await res.json()
        setRows(data.rows || [])
      } finally {
        setLoading(false)
      }
    })()
  }, [user, isLoading])

  if (isLoading || loading) {
    return <div className="p-6">Loading...</div>
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="p-6">
        <div className="mb-4 text-gray-600">You do not have access to audit logs.</div>
        <Link href="/dashboard" className="text-blue-600 underline">Back to dashboard</Link>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <p className="text-sm text-gray-500">Latest 200 events</p>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="px-3 py-2 text-left">Time</th>
              <th className="px-3 py-2 text-left">Action</th>
              <th className="px-3 py-2 text-left">Actor</th>
              <th className="px-3 py-2 text-left">Target</th>
              <th className="px-3 py-2 text-left">Outcome</th>
              <th className="px-3 py-2 text-left">Message</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const time = row.createdAt?.toDate ? row.createdAt.toDate() : (row.createdAt ? new Date(row.createdAt) : null)
              return (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2 whitespace-nowrap">{time ? time.toLocaleString() : '-'}</td>
                  <td className="px-3 py-2">{row.action}</td>
                  <td className="px-3 py-2">{row.actorId || '-'} {row.actorRole ? `(${row.actorRole})` : ''}</td>
                  <td className="px-3 py-2">{row.targetType || '-'} {row.targetId ? `#${row.targetId}` : ''}</td>
                  <td className="px-3 py-2">{row.outcome || '-'}</td>
                  <td className="px-3 py-2 max-w-[28rem] truncate" title={row.message || ''}>{row.message || '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}



