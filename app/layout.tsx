"use client"

import "./globals.css"
import { Providers } from "@/components/providers"
import { Toaster } from 'react-hot-toast'
import { MainLayout } from '@/components/layouts/main-layout'
import { useAuth } from '@/contexts/auth-context'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { usePathname } from 'next/navigation'
import { Loader2 } from 'lucide-react'

const publicPaths = ['/auth/sign-in', '/auth/sign-up', '/auth/forgot-password']

function MainContent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const pathname = usePathname()

  // Allow access to public paths without authentication
  if (publicPaths.includes(pathname)) {
    return <>{children}</>
  }

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Redirect to sign-in if not authenticated
  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} />
      <div className="flex">
        <Sidebar activePath={pathname} />
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50">
        <Providers>
          <MainContent>
            {children}
          </MainContent>
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
