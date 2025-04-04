'use client'

import { User } from 'firebase/auth'
import { LogOut, Bell, Settings } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'

interface HeaderProps {
  user: User
  userData: {
    role: string
  }
}

export default function Header({ user, userData }: HeaderProps) {
  const { logout } = useAuth()
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await logout()
      router.push('/auth/sign-in')
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  return (
    <header className="bg-white shadow-sm">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold text-gray-800">
            KayStone HR
          </h1>
          <span className="px-2 py-1 text-sm font-medium text-gray-600 bg-gray-100 rounded-full">
            {userData.role.charAt(0).toUpperCase() + userData.role.slice(1)}
          </span>
        </div>

        <div className="flex items-center space-x-4">
          <button className="p-2 text-gray-600 hover:text-gray-800 rounded-full hover:bg-gray-100">
            <Bell className="w-5 h-5" />
          </button>
          
          <button 
            onClick={() => router.push('/dashboard/profile')}
            className="p-2 text-gray-600 hover:text-gray-800 rounded-full hover:bg-gray-100"
          >
            <Settings className="w-5 h-5" />
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </header>
  )
} 