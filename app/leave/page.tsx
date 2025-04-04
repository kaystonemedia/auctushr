'use client'

import { useState } from 'react'
import { LeaveRequestForm } from "@/components/leave-request-form"
import { LeaveRequestsList } from "@/components/leave-requests-list"
import { LeaveBalanceDisplay } from "@/components/leave-balance"
import { useAuth } from "@/contexts/auth-context"
import { Plus, Calendar, Clock, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function LeavePage() {
  const { user } = useAuth()
  const [showForm, setShowForm] = useState(false)
  const [view, setView] = useState<'all' | 'pending' | 'my'>('all')

  return (
    <div className="py-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Leave Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage leave requests and approvals</p>
        </div>

        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Request Leave
        </Button>
      </div>

      {/* Leave Balance */}
      <div>
        <LeaveBalanceDisplay />
      </div>

      {/* View Tabs */}
      <div className="flex space-x-4">
        {user?.role === 'admin' || user?.role === 'manager' ? (
          <>
            <Button
              variant={view === 'all' ? 'default' : 'outline'}
              onClick={() => setView('all')}
            >
              <Calendar className="h-4 w-4 mr-2" />
              All Requests
            </Button>
            <Button
              variant={view === 'pending' ? 'default' : 'outline'}
              onClick={() => setView('pending')}
            >
              <Clock className="h-4 w-4 mr-2" />
              Pending
            </Button>
          </>
        ) : null}
        <Button
          variant={view === 'my' ? 'default' : 'outline'}
          onClick={() => setView('my')}
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          My Requests
        </Button>
      </div>

      {/* Leave Requests List */}
      <LeaveRequestsList view={view} />

      {/* Leave Request Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-lg font-semibold mb-4">Submit Leave Request</h2>
            <LeaveRequestForm
              onClose={() => setShowForm(false)}
              onSuccess={() => {
                setView('my')
                setShowForm(false)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
} 