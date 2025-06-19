'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useNewAuth } from '@/contexts/new-auth-context'
import {
  LayoutDashboard,
  User,
  Users,
  Calendar,
  FileText,
  BarChart3,
  Briefcase,
  Mail,
  Settings,
  HelpCircle,
  Folder,
  Activity,
  LineChart,
  Wallet,
  ClipboardList,
  BookOpen,
  UserCheck,
  UserX,
  AlertCircle,
  FileBarChart2,
  Building2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

const sections = [
  {
    heading: 'MAIN',
    items: [
      { title: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" />, roles: ['admin', 'manager', 'employee'] },
      { title: 'Profile', href: '/profile', icon: <User className="w-5 h-5" />, roles: ['admin', 'manager', 'employee'] },
    ],
  },
  {
    heading: 'PEOPLE MANAGEMENT',
    items: [
      { title: 'Managers', href: '/managers', icon: <UserCheck className="w-5 h-5" />, roles: ['admin'] },
      { title: 'Administrators', href: '/administrators', icon: <UserCheck className="w-5 h-5" />, roles: ['admin'] },
      { title: 'Employees', href: '/employees', icon: <Users className="w-5 h-5" />, roles: ['admin', 'manager'] },
      { title: 'Departments', href: '/departments', icon: <Building2 className="w-5 h-5" />, roles: ['admin'] },
    ],
  },
  {
    heading: 'ATTENDANCE & LEAVE',
    items: [
      { title: 'Attendance', href: '/attendance', icon: <Calendar className="w-5 h-5" />, roles: ['admin', 'manager'] },
      { title: 'Leave Management', href: '/leave', icon: <ClipboardList className="w-5 h-5" />, roles: ['admin', 'manager'] },
      { title: 'Attendance Reports', href: '/attendance/reports', icon: <FileBarChart2 className="w-5 h-5" />, roles: ['admin', 'manager'] },
    ],
  },
  {
    heading: 'PERFORMANCE',
    items: [
      { title: 'Productivity', href: '/productivity', icon: <Activity className="w-5 h-5" />, roles: ['admin', 'manager', 'employee'] },
      { title: 'Performance', href: '/performance', icon: <LineChart className="w-5 h-5" />, roles: ['admin', 'manager', 'employee'] },
    ],
  },
  {
    heading: 'RESOURCES',
    items: [
      { title: 'Documents', href: '/documents', icon: <FileText className="w-5 h-5" />, roles: ['admin', 'manager', 'employee'] },
      { title: 'Payroll', href: '/payroll', icon: <Wallet className="w-5 h-5" />, roles: ['admin', 'manager'] },
    ],
  },
  {
    heading: 'SYSTEM',
    items: [
      { title: 'Settings', href: '/settings', icon: <Settings className="w-5 h-5" />, roles: ['admin', 'manager'] },
      { title: 'Help & Support', href: '/help', icon: <HelpCircle className="w-5 h-5" />, roles: ['admin', 'manager', 'employee'] },
    ],
  },
]

interface SidebarProps {
  activePath?: string
}

export function Sidebar({ activePath }: SidebarProps) {
  const pathname = usePathname()
  const { user } = useNewAuth()
  
  // Use activePath prop if provided, otherwise use current pathname
  const currentPath = activePath || pathname

  if (!user) return null

  return (
    <aside className="w-64 h-full bg-white border-r flex flex-col">
      <div className="px-6 py-4 text-xl font-bold tracking-tight">KayStoneHR</div>
      <ScrollArea className="flex-1">
        <nav className="px-2">
          {sections.map(section => {
            // Only show section if at least one item is visible for this role
            const visibleItems = section.items.filter(item => item.roles.includes(user.role))
            if (visibleItems.length === 0) return null
            return (
              <div key={section.heading} className="mb-4">
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {section.heading}
                </div>
                <ul className="space-y-1">
                  {visibleItems.map(item => (
                    <li key={item.title}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center px-4 py-2 rounded-lg transition-colors hover:bg-gray-100 text-gray-700',
                          currentPath === item.href && 'bg-gray-100 font-semibold text-primary'
                        )}
                      >
                        {item.icon}
                        <span className="ml-3">{item.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </nav>
      </ScrollArea>
      <div className="px-6 py-4 mt-auto flex items-center gap-3 border-t">
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600">
          {user.name?.[0]}
        </div>
        <div>
          <div className="font-semibold text-sm">{user.name}</div>
          <div className="text-xs text-gray-500 capitalize">{user.role}</div>
        </div>
      </div>
    </aside>
  )
}

