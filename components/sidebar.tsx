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
  FileBarChart2,
  Building2,
  Wrench,
  ChevronLeft,
  ChevronRight,
  Monitor,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SidebarLogo } from '@/components/ui/logo'

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
    heading: 'ATTENDANCE & TASKS',
    items: [
      { title: 'Attendance', href: '/attendance', icon: <Calendar className="w-5 h-5" />, roles: ['admin', 'manager', 'employee'] },
      { title: 'My Tasks', href: '/my-tasks', icon: <ClipboardList className="w-5 h-5" />, roles: ['employee'] },
      { title: 'Leave', href: '/leave', icon: <BookOpen className="w-5 h-5" />, roles: ['employee'] },
      { title: 'Leave Management', href: '/leave', icon: <BookOpen className="w-5 h-5" />, roles: ['admin', 'manager'] },
      { title: 'Attendance Reports', href: '/attendance/reports', icon: <FileBarChart2 className="w-5 h-5" />, roles: ['admin', 'manager'] },
    ],
  },
  {
    heading: 'PERFORMANCE',
    items: [
      { title: 'Productivity', href: '/productivity', icon: <Activity className="w-5 h-5" />, roles: ['admin', 'manager'] },
      { title: 'Performance', href: '/performance', icon: <LineChart className="w-5 h-5" />, roles: ['admin', 'manager'] },
      { title: 'Team activity', href: '/monitoring', icon: <Monitor className="w-5 h-5" />, roles: ['admin', 'manager'] },
    ],
  },
  {
    heading: 'RESOURCES',
    items: [
      { title: 'Documents', href: '/documents', icon: <FileText className="w-5 h-5" />, roles: ['admin', 'manager'] },
      { title: 'Payroll', href: '/payroll', icon: <Wallet className="w-5 h-5" />, roles: ['admin', 'manager'] },
      { title: 'Payslips', href: '/payslip', icon: <FileText className="w-5 h-5" />, roles: ['admin', 'manager', 'employee'] },
    ],
  },
  {
    heading: 'SYSTEM',
    items: [
      { title: 'Tools', href: '/tools', icon: <Wrench className="w-5 h-5" />, roles: ['admin', 'manager', 'employee'] },
      { title: 'Settings', href: '/settings', icon: <Settings className="w-5 h-5" />, roles: ['admin', 'manager'] },
      { title: 'Help & Support', href: '/help', icon: <HelpCircle className="w-5 h-5" />, roles: ['admin', 'manager', 'employee'] },
    ],
  },
]

interface SidebarProps {
  activePath?: string
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

export function Sidebar({ activePath, isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname()
  const { user } = useNewAuth()
  
  // Use activePath prop if provided, otherwise use current pathname
  const currentPath = activePath || pathname

  if (!user) return null

  return (
    <aside className={cn(
      "h-full bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300",
      isCollapsed ? "w-16" : "w-64"
    )}>
      {/* Logo Section */}
      <div className={cn(
        "px-6 py-6 flex items-center transition-all duration-300",
        isCollapsed ? "px-2 justify-center relative" : "justify-between"
      )}>
        {!isCollapsed && <SidebarLogo />}
        {isCollapsed && (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-mint via-emerald-500 to-corporate-navy shadow-lg ring-2 ring-emerald-mint/20 flex items-center justify-center">
            <span className="text-white font-bold text-base">A</span>
          </div>
        )}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={cn(
              "p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors",
              isCollapsed && "absolute -right-3 top-1/2 -translate-y-1/2 bg-sidebar border border-sidebar-border shadow-md z-10"
            )}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
      
      <ScrollArea className="flex-1">
        <nav className="px-2">
          {sections.map(section => {
            // Only show section if at least one item is visible for this role
            const visibleItems = section.items.filter(item => item.roles.includes(user.role))
            if (visibleItems.length === 0) return null
            return (
              <div key={section.heading} className="mb-6">
                {!isCollapsed && (
                  <div className="px-4 py-2 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
                    {section.heading}
                  </div>
                )}
                <ul className="space-y-1">
                  {visibleItems.map(item => (
                    <li key={item.title}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center rounded-lg transition-colors hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-foreground',
                          isCollapsed ? 'px-2 py-3 justify-center' : 'px-4 py-3',
                          currentPath === item.href && 'bg-sidebar-accent text-sidebar-foreground font-semibold'
                        )}
                        title={isCollapsed ? item.title : undefined}
                      >
                        <span className="text-sidebar-foreground/70 flex-shrink-0">{item.icon}</span>
                        {!isCollapsed && <span className="ml-3">{item.title}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </nav>
      </ScrollArea>
      
      {/* User Profile Section */}
      <div className={cn(
        "py-4 mt-auto flex items-center border-t border-sidebar-border",
        isCollapsed ? "px-2 justify-center" : "px-6 gap-3"
      )}>
        <div className="w-10 h-10 rounded-full bg-sidebar-accent flex items-center justify-center font-bold text-sidebar-foreground flex-shrink-0">
          {user.name?.[0]?.toUpperCase()}
        </div>
        {!isCollapsed && (
          <div className="min-w-0">
            <div className="font-semibold text-sm text-sidebar-foreground truncate">{user.name}</div>
            <div className="text-xs text-sidebar-foreground/60 capitalize">{user.role}</div>
          </div>
        )}
      </div>
    </aside>
  )
}

