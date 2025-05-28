import "./globals.css"
import { Providers } from "@/components/providers"
import { Toaster } from 'react-hot-toast'
import { ClientLayout } from '@/components/layouts/client-layout'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50">
        <Providers>
          <ClientLayout>
            {children}
          </ClientLayout>
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
