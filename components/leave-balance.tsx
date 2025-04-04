'use client'

import { useState, useEffect } from 'react'
import { LeaveBalance as LeaveBalanceType } from '@/types/leave'
import { useAuth } from '@/contexts/auth-context'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { Calendar, Activity, Heart, Baby, Users, Umbrella, Clock } from 'lucide-react'

export function LeaveBalanceDisplay() {
  const { user } = useAuth()
  const [balance, setBalance] = useState<LeaveBalanceType | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLeaveBalance()
  }, [user?.id])

  const fetchLeaveBalance = async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      const currentYear = new Date().getFullYear()
      const balanceRef = doc(db, 'leaveBalances', `${user.id}_${currentYear}`)
      const balanceDoc = await getDoc(balanceRef)

      if (balanceDoc.exists()) {
        setBalance(balanceDoc.data() as LeaveBalanceType)
      } else {
        // Initialize with default values if no balance exists
        const defaultBalance: LeaveBalanceType = {
          employeeId: user.id,
          year: currentYear,
          annual: 20, // Default annual leave days
          sick: 10,
          personal: 5,
          maternity: 90,
          paternity: 10,
          bereavement: 5,
          unpaid: 0,
          updatedAt: new Date()
        }
        setBalance(defaultBalance)
      }
    } catch (error) {
      console.error('Error fetching leave balance:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-4">Loading balance...</div>
  }

  if (!balance) {
    return <div className="text-center py-4">No leave balance found</div>
  }

  const balanceItems = [
    { name: 'Annual Leave', value: balance.annual, icon: Calendar, color: 'text-blue-500' },
    { name: 'Sick Leave', value: balance.sick, icon: Activity, color: 'text-red-500' },
    { name: 'Personal Leave', value: balance.personal, icon: Heart, color: 'text-pink-500' },
    { name: 'Maternity Leave', value: balance.maternity, icon: Baby, color: 'text-purple-500' },
    { name: 'Paternity Leave', value: balance.paternity, icon: Users, color: 'text-indigo-500' },
    { name: 'Bereavement Leave', value: balance.bereavement, icon: Umbrella, color: 'text-gray-500' },
    { name: 'Unpaid Leave', value: balance.unpaid, icon: Clock, color: 'text-yellow-500' }
  ]

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold mb-4">Leave Balance</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {balanceItems.map((item) => (
          <div
            key={item.name}
            className="flex items-center p-4 bg-gray-50 rounded-lg"
          >
            <item.icon className={`h-6 w-6 ${item.color} mr-3`} />
            <div>
              <p className="text-sm text-gray-500">{item.name}</p>
              <p className="font-medium">{item.value} days</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
} 