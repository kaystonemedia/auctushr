'use client'

import { useNewAuth } from '@/contexts/new-auth-context'
import { LayoutDashboard, User2, Users, Clock, FileText, FileSpreadsheet, BarChart2, Settings, LogOut } from 'lucide-react'
import { ViewType } from '@/types/navigation'

interface SidebarProps {
  currentView: ViewType
  onViewChange: (view: ViewType) => void
}

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const { user, logout } = useNewAuth()

  const getNavItems = () => {
    const commonItems = [
      { view: 'dashboard' as ViewType, label: 'Dashboard', icon: LayoutDashboard },
      { view: 'profile' as ViewType, label: 'Profile', icon: User2 },
    ]

    switch (user?.role) {
      case 'admin':
        return [
          ...commonItems,
          { view: 'employees' as ViewType, label: 'Employees', icon: Users },
          { view: 'attendance' as ViewType, label: 'Attendance', icon: Clock },
          { view: 'attendance-reports' as ViewType, label: 'Attendance Reports', icon: FileText },
          { view: 'leave-management' as ViewType, label: 'Leave Management', icon: FileSpreadsheet },
          { view: 'payroll' as ViewType, label: 'Payroll', icon: FileSpreadsheet },
          { view: 'productivity' as ViewType, label: 'Productivity', icon: BarChart2 },
          { view: 'documents' as ViewType, label: 'Documents', icon: FileText },
          { view: 'settings' as ViewType, label: 'Settings', icon: Settings },
        ]
      case 'manager':
        return [
          ...commonItems,
          { view: 'team' as ViewType, label: 'Team', icon: Users },
          { view: 'attendance' as ViewType, label: 'Attendance', icon: Clock },
          { view: 'attendance-reports' as ViewType, label: 'Attendance Reports', icon: FileText },
          { view: 'leave-management' as ViewType, label: 'Leave Management', icon: FileSpreadsheet },
          { view: 'productivity' as ViewType, label: 'Productivity', icon: BarChart2 },
          { view: 'documents' as ViewType, label: 'Documents', icon: FileText },
        ]
      case 'employee':
        return [
          ...commonItems,
          { view: 'attendance' as ViewType, label: 'Attendance', icon: Clock },
          { view: 'leave-management' as ViewType, label: 'Leave Management', icon: FileSpreadsheet },
          { view: 'documents' as ViewType, label: 'Documents', icon: FileText },
        ]
      default:
        return commonItems
    }
  }

  return (
    <aside className="w-64 bg-white border-r border-gray-200">
      <div className="flex flex-col h-full">
        <div className="flex-1 py-6 flex flex-col">
          <nav className="mt-6 px-4 space-y-2">
            {getNavItems().map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.view}
                  onClick={() => onViewChange(item.view)}
                  className={`flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors w-full ${
                    currentView === item.view
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  <Icon className="h-5 w-5 mr-3" />
                  {item.label}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={logout}
            className="flex items-center w-full px-4 py-2.5 text-sm font-medium text-gray-700 rounded-lg hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="h-5 w-5 mr-3" />
            Logout
          </button>
        </div>
      </div>
    </aside>
  )
} 