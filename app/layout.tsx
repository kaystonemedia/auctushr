import "./globals.css"
import { Providers } from "@/components/providers"
import { Toaster } from '@/components/ui/toaster'
import { MainLayout } from '@/components/layouts/main-layout'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'KaystoneHR',
  description: 'KaystoneHR - Your HR Management Platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
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
