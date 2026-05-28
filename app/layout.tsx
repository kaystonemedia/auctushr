import "./globals.css"
import { Providers } from "@/components/providers"
import { Toaster } from '@/components/ui/toaster'
import { MainLayout } from '@/components/layouts/main-layout'
import { ElectronTitleBar } from '@/components/electron/title-bar'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Auctushr',
  description: 'Auctushr - Your HR Management Platform',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ElectronTitleBar />
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
