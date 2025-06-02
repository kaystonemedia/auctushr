'use client'

import { useNewAuth } from '@/contexts/new-auth-context'
import { Bell, User } from 'lucide-react'
import Link from 'next/link'

export function Header() {
  const { user } = useNewAuth()

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div className="flex items-center space-x-4">
        <h1 className="text-xl font-semibold text-gray-800">
          {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : ''} Dashboard
        </h1>
      </div>
      
      <div className="flex items-center space-x-4">
        <button className="rounded-full p-2 text-gray-600 hover:bg-gray-100">
          <Bell className="h-5 w-5" />
        </button>
        <Link
          href="/profile"
          className="flex items-center space-x-2 rounded-full p-2 text-gray-600 hover:bg-gray-100"
        >
          <User className="h-5 w-5" />
          <span className="text-sm font-medium">
            {user?.name || 'User'}
          </span>
        </Link>
      </div>
    </header>
  )
} 