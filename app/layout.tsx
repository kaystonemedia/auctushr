"use client"

import "./globals.css"
import { Providers } from "@/components/providers"
import { Toaster } from 'react-hot-toast'
import { MainLayout } from '@/components/layouts/main-layout'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50">
        <Providers>
          <MainLayout>
            {children}
          </MainLayout>
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
