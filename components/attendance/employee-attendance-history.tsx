"use client"

import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore'

export function EmployeeAttendanceHistory({ employeeId }: { employeeId: string }) {
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAttendance = async () => {
      setLoading(true)
      const q = query(
        collection(db, 'attendance'),
        where('employeeId', '==', employeeId),
        orderBy('date', 'desc')
      )
      const snapshot = await getDocs(q)
      setRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
      setLoading(false)
    }
    fetchAttendance()
  }, [employeeId])

  if (loading) return <div>Loading attendance...</div>
  if (records.length === 0) return <div>No attendance records found.</div>

  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead>
        <tr>
          <th>Date</th>
          <th>Status</th>
          <th>Check In</th>
          <th>Check Out</th>
        </tr>
      </thead>
      <tbody>
        {records.map(record => (
          <tr key={record.id}>
            <td>{record.date?.toDate().toLocaleDateString()}</td>
            <td>{record.status}</td>
            <td>{record.checkIn?.time?.toDate().toLocaleTimeString() || '-'}</td>
            <td>{record.checkOut?.time?.toDate().toLocaleTimeString() || '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
} 