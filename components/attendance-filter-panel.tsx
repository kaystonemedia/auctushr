import { useState } from 'react'
import { Filter, X } from 'lucide-react'
import { AttendanceFilters } from '@/types/attendance'

interface AttendanceFilterPanelProps {
  isOpen: boolean
  onClose: () => void
  onApply: (filters: AttendanceFilters) => void
  onClear: () => void
  departments: string[]
  currentFilters: AttendanceFilters
}

export function AttendanceFilterPanel({
  isOpen,
  onClose,
  onApply,
  onClear,
  departments,
  currentFilters
}: AttendanceFilterPanelProps) {
  const [filters, setFilters] = useState<AttendanceFilters>(currentFilters)

  const handleApply = () => {
    onApply(filters)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-end">
      <div className="bg-white w-96 h-full p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Filter Attendance</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6">
          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date Range
            </label>
            <div className="space-y-2">
              <input
                type="date"
                value={filters.startDate?.toISOString().split('T')[0] || ''}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  startDate: e.target.value ? new Date(e.target.value) : undefined
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <input
                type="date"
                value={filters.endDate?.toISOString().split('T')[0] || ''}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  endDate: e.target.value ? new Date(e.target.value) : undefined
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>

          {/* Department */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Department
            </label>
            <select
              value={filters.department || ''}
              onChange={(e) => setFilters(prev => ({
                ...prev,
                department: e.target.value || undefined
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={filters.status || ''}
              onChange={(e) => setFilters(prev => ({
                ...prev,
                status: e.target.value as AttendanceFilters['status'] || undefined
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">All Statuses</option>
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="absent">Absent</option>
              <option value="early_leave">Early Leave</option>
              <option value="half_day">Half Day</option>
            </select>
          </div>

          {/* Approval Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Approval Status
            </label>
            <select
              value={filters.approvalStatus || ''}
              onChange={(e) => setFilters(prev => ({
                ...prev,
                approvalStatus: e.target.value as AttendanceFilters['approvalStatus'] || undefined
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">All Approval Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search
            </label>
            <input
              type="text"
              placeholder="Search by employee name..."
              value={filters.search || ''}
              onChange={(e) => setFilters(prev => ({
                ...prev,
                search: e.target.value || undefined
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
        </div>

        <div className="mt-8 flex justify-between">
          <button
            onClick={onClear}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            Clear All
          </button>
          <button
            onClick={handleApply}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  )
} 