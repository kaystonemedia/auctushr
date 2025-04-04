'use client'

import { useRouter, usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Calendar,
  FileText,
  Settings,
  User,
  BarChart,
  ClipboardList,
  Building2,
  Mail,
  HelpCircle,
  Activity
} from 'lucide-react'

interface SidebarProps {
  role: string
}

interface NavItem {
  title: string
  href: string
  icon: React.ReactNode
  roles: string[]
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard className="w-5 h-5" />,
    roles: ['admin', 'manager', 'employee']
  },
  {
    title: 'Employees',
    href: '/dashboard/employees',
    icon: <Users className="w-5 h-5" />,
    roles: ['admin', 'manager']
  },
  {
    title: 'Attendance',
    href: '/dashboard/attendance',
    icon: <Calendar className="w-5 h-5" />,
    roles: ['admin', 'manager', 'employee']
  },
  {
    title: 'Attendance Report',
    href: '/dashboard/attendance-report',
    icon: <BarChart className="w-5 h-5" />,
    roles: ['admin', 'manager']
  },
  {
    title: 'Documents',
    href: '/dashboard/documents',
    icon: <FileText className="w-5 h-5" />,
    roles: ['admin', 'manager']
  },
  {
    title: 'Leave Management',
    href: '/dashboard/leave',
    icon: <ClipboardList className="w-5 h-5" />,
    roles: ['admin', 'manager']
  },
  {
    title: 'Departments',
    href: '/dashboard/departments',
    icon: <Building2 className="w-5 h-5" />,
    roles: ['admin']
  },
  {
    title: 'Productivity',
    href: '/productivity',
    icon: <Activity className="w-5 h-5" />,
    roles: ['admin', 'manager']
  },
  {
    title: 'Messages',
    href: '/dashboard/messages',
    icon: <Mail className="w-5 h-5" />,
    roles: ['admin', 'manager', 'employee']
  },
  {
    title: 'Settings',
    href: '/dashboard/settings',
    icon: <Settings className="w-5 h-5" />,
    roles: ['admin', 'manager']
  },
  {
    title: 'Profile',
    href: '/dashboard/profile',
    icon: <User className="w-5 h-5" />,
    roles: ['admin', 'manager', 'employee']
  },
  {
    title: 'Help & Support',
    href: '/dashboard/help',
    icon: <HelpCircle className="w-5 h-5" />,
    roles: ['admin', 'manager', 'employee']
  }
]

export default function Sidebar({ role }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()

  // Filter nav items based on role
  const filteredNavItems = navItems.filter(item => item.roles.includes(role))

  return (
    <aside className="w-64 bg-white shadow-sm">
      <nav className="mt-5 px-2">
        <div className="space-y-1">
          {filteredNavItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`w-full flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {item.icon}
                <span className="ml-3">{item.title}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </aside>
  )
} 