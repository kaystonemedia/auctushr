'use client'

import { useState } from 'react'
import { LeaveRequestForm } from "@/components/leave-request-form"
import { LeaveRequestsList } from "@/components/leave-requests-list"
import { LeaveBalanceDisplay } from "@/components/leave-balance"
import { useNewAuth } from "@/contexts/new-auth-context"
import { Plus, Calendar, Clock, CheckCircle, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function LeavePage() {
  const { user } = useNewAuth()
  const [showForm, setShowForm] = useState(false)
  // Default to 'my' view for employees, 'all' for admins/managers
  const [view, setView] = useState<'all' | 'pending' | 'my'>(
    user?.role === 'employee' ? 'my' : 'all'
  )

  return (
    <div className="py-10 px-4 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 text-blue-600 rounded-full p-2">
            <CalendarDays className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-3xl font-bold leading-tight">
              {user?.role === 'employee' ? 'My Leave' : 'Leave Management'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {user?.role === 'employee' 
                ? 'View your leave balance and request time off' 
                : 'Manage leave requests and approvals'
              }
            </p>
          </div>
        </div>
        <Button className="shadow-lg" size="lg" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Request Leave
        </Button>
      </div>

      {/* Leave Balance */}
      <div className="mb-6">
        <LeaveBalanceDisplay />
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 mb-4">
        {(user?.role === 'admin' || user?.role === 'manager') && (
          <>
            <Button
              variant={view === 'all' ? 'default' : 'outline'}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${view === 'all' ? 'shadow' : ''}`}
              onClick={() => setView('all')}
            >
              <Calendar className="h-4 w-4 mr-2" />
              All Requests
            </Button>
            <Button
              variant={view === 'pending' ? 'default' : 'outline'}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${view === 'pending' ? 'shadow' : ''}`}
              onClick={() => setView('pending')}
            >
              <Clock className="h-4 w-4 mr-2" />
              Pending
            </Button>
          </>
        )}
        <Button
          variant={view === 'my' ? 'default' : 'outline'}
          className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${view === 'my' ? 'shadow' : ''}`}
          onClick={() => setView('my')}
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          My Requests
        </Button>
      </div>

      {/* Leave Requests List */}
      <div>
        <LeaveRequestsList view={view} />
      </div>

      {/* Leave Request Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-lg font-semibold mb-4">Submit Leave Request</h2>
            <LeaveRequestForm
              isOpen={true}
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