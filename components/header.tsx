'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User, Settings, LogOut, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNewAuth } from '@/contexts/new-auth-context'
import { NotificationsDropdown } from '@/components/notifications-dropdown'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export function Header() {
  const { user, signOut } = useNewAuth()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    try {
      await signOut()
      router.push('/auth/sign-in')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  if (!user) {
    return null
  }

  return (
    <div className="flex items-center space-x-4">
      <NotificationsDropdown />

      <div className="relative" ref={dropdownRef}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center space-x-2 text-gray-700 hover:text-gray-900"
        >
          <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
            <User className="h-5 w-5 text-gray-500" />
          </div>
          <span className="text-sm font-medium hidden sm:block">{user?.name || user?.email}</span>
          <ChevronDown className={cn(
            "h-4 w-4 transition-transform",
            isDropdownOpen ? "transform rotate-180" : ""
          )} />
        </Button>

        {isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
            <Link
              href="/profile"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              onClick={() => setIsDropdownOpen(false)}
            >
              <User className="inline h-4 w-4 mr-2" />
              Profile
            </Link>
            <Link
              href="/settings"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              onClick={() => setIsDropdownOpen(false)}
            >
              <Settings className="inline h-4 w-4 mr-2" />
              Settings
            </Link>
            <button
              onClick={handleLogout}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <LogOut className="inline h-4 w-4 mr-2" />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

