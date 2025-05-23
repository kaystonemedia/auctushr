'use client'

import type React from "react"
import Link from "next/link"
import { Users, Clock, FileText, BarChart3, Settings, LogOut, Wallet, User, Calendar, LineChart, LayoutDashboard, Activity, HelpCircle, Bell } from "lucide-react"
import { Logo } from "./logo"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { signOut } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { motion } from "framer-motion"
import { useState } from "react"
import { cn } from '@/lib/utils'
import { Button } from './ui/button'

interface SidebarProps {
  activePath?: string
}

interface NavItem {
  name: string
  href: string
  icon: React.ElementType
  roles?: string[]
  category?: string
}

const navItems: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['admin', 'manager', 'employee'],
    category: 'main'
  },
  {
    name: 'Profile',
    href: '/profile',
    icon: User,
    roles: ['admin', 'manager', 'employee'],
    category: 'main'
  },
  {
    name: 'Employees',
    href: '/employees',
    icon: Users,
    roles: ['admin', 'manager'],
    category: 'management'
  },
  {
    name: 'Attendance',
    href: '/attendance',
    icon: Clock,
    roles: ['admin', 'manager', 'employee'],
    category: 'management'
  },
  {
    name: 'Attendance Reports',
    href: '/attendance/reports',
    icon: BarChart3,
    roles: ['admin', 'manager'],
    category: 'reports'
  },
  {
    name: 'Leave Management',
    href: '/leave',
    icon: Calendar,
    roles: ['admin', 'manager', 'employee'],
    category: 'management'
  },
  {
    name: 'Payroll',
    href: '/payroll',
    icon: Wallet,
    roles: ['admin', 'manager'],
    category: 'management'
  },
  {
    name: 'Documents',
    href: '/documents',
    icon: FileText,
    roles: ['admin', 'manager', 'employee'],
    category: 'resources'
  },
  {
    name: 'Productivity',
    href: '/productivity',
    icon: Activity,
    roles: ['admin', 'manager', 'employee'],
    category: 'performance'
  },
  {
    name: 'Performance',
    href: '/performance',
    icon: BarChart3,
    roles: ['admin', 'manager', 'employee'],
    category: 'performance'
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    roles: ['admin', 'manager', 'employee'],
    category: 'system'
  },
  {
    name: 'Help & Support',
    href: '/help',
    icon: HelpCircle,
    roles: ['admin', 'manager', 'employee'],
    category: 'system'
  }
]

const categoryLabels: Record<string, string> = {
  main: 'Main',
  management: 'Management',
  reports: 'Reports',
  resources: 'Resources',
  performance: 'Performance',
  system: 'System'
}

export function Sidebar({ activePath }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const [activeButton, setActiveButton] = useState(pathname)

  const handleLogout = async () => {
    try {
      await signOut(auth)
      router.push('/auth/sign-in')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  if (!user) return null

  const filteredNavItems = navItems.filter(item => 
    item.roles?.includes(user.role)
  )

  // Group items by category
  const groupedItems = filteredNavItems.reduce((acc, item) => {
    const category = item.category || 'other'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(item)
    return acc
  }, {} as Record<string, NavItem[]>)

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-white shadow-lg">
      <div className="p-4 border-b">
        <Logo className="h-8 w-auto" />
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-6 px-3">
          {Object.entries(groupedItems).map(([category, items]) => (
            <div key={category} className="space-y-1">
              <h3 className="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {categoryLabels[category]}
              </h3>
              {items.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'group flex items-center rounded-md px-2 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    )}
                  >
                    <item.icon
                      className={cn(
                        'mr-3 h-5 w-5 flex-shrink-0 transition-colors',
                        isActive 
                          ? 'text-primary-foreground' 
                          : 'text-gray-500 group-hover:text-gray-700'
                      )}
                      aria-hidden="true"
                    />
                    {item.name}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>
      </div>
      <div className="border-t border-gray-200 p-4 bg-gray-50">
        <div className="flex items-center space-x-3 px-2 py-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user.name}
            </p>
            <p className="text-xs text-gray-500 truncate capitalize">
              {user.role}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-gray-700 hover:bg-gray-100 hover:text-gray-900 mt-2"
          onClick={logout}
        >
          <LogOut className="mr-3 h-5 w-5" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}

