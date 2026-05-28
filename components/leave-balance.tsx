'use client'

import { useState, useEffect } from 'react'
import { LeaveBalance as LeaveBalanceType } from '@/types/leave'
import { useNewAuth } from '@/contexts/new-auth-context'
import { Calendar, Heart, HeartHandshake, Baby, Users, Umbrella, Clock } from 'lucide-react'

export function LeaveBalanceDisplay() {
  const { user } = useNewAuth()
  const [balance, setBalance] = useState<LeaveBalanceType | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLeaveBalance = async () => {
      if (!user?.id) return
      try {
        setLoading(true)
        const res = await fetch('/api/leave/balance', { credentials: 'include' })
        if (!res.ok) throw new Error('Failed to load balance')
        const data = await res.json()
        setBalance({
          ...data.balance,
          updatedAt: new Date(data.balance.updatedAt),
        })
      } catch (error) {
        console.error('Error fetching leave balance:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchLeaveBalance()
  }, [user?.id])

  if (loading) {
    return <div className="text-center py-4">Loading balance...</div>
  }

  if (!balance) {
    return <div className="text-center py-4">No leave balance found</div>
  }

  const balanceItems = [
    { name: 'Annual Leave', value: balance.annual, icon: Calendar, color: 'text-blue-500', bgColor: 'bg-blue-50' },
    { name: 'Sick Leave', value: balance.sick, icon: HeartHandshake, color: 'text-red-500', bgColor: 'bg-red-50' },
    { name: 'Personal Leave', value: balance.personal, icon: Heart, color: 'text-pink-500', bgColor: 'bg-pink-50' },
    { name: 'Maternity Leave', value: balance.maternity, icon: Baby, color: 'text-purple-500', bgColor: 'bg-purple-50' },
    { name: 'Paternity Leave', value: balance.paternity, icon: Users, color: 'text-indigo-500', bgColor: 'bg-indigo-50' },
    { name: 'Bereavement Leave', value: balance.bereavement, icon: Umbrella, color: 'text-gray-500', bgColor: 'bg-gray-50' },
    { name: 'Unpaid Leave', value: balance.unpaid, icon: Clock, color: 'text-yellow-500', bgColor: 'bg-yellow-50' },
  ]

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold mb-4">Leave Balance ({balance.year})</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {balanceItems.map((item) => (
          <div
            key={item.name}
            className={`flex items-center p-4 ${item.bgColor} rounded-lg border border-gray-100`}
          >
            <item.icon className={`h-6 w-6 ${item.color} mr-3`} />
            <div>
              <p className="text-sm text-gray-600">{item.name}</p>
              <p className="text-xl font-semibold">{item.value} days</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
