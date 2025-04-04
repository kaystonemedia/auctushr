interface SidebarProps {
  activePath: string
}

export function Sidebar({ activePath }: SidebarProps) {
  return (
    <div className="w-64 bg-white shadow-lg">
      <div className="h-full px-3 py-4">
        <div className="space-y-1">
          <a
            href="/"
            className={`flex items-center px-4 py-2 text-sm font-medium rounded-md ${
              activePath === '/' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            Dashboard
          </a>
          <a
            href="/profile"
            className={`flex items-center px-4 py-2 text-sm font-medium rounded-md ${
              activePath === '/profile' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            Profile
          </a>
          <a
            href="/settings"
            className={`flex items-center px-4 py-2 text-sm font-medium rounded-md ${
              activePath === '/settings' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            Settings
          </a>
        </div>
      </div>
    </div>
  )
} 