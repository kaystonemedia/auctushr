import { Metadata } from 'next'
import "./globals.css"
import { Providers } from "@/components/providers"
import { Toaster } from 'react-hot-toast'
import { AuthLayout } from "@/components/layouts/auth-layout"

export const metadata: Metadata = {
  title: "KayStone HR",
  description: "Employee Management System",
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
          <AuthLayout>
            <div className="flex min-h-screen">
              <div className="flex-1 flex">
                <div className="flex-1 bg-slate-50">
                  <div className="min-h-screen bg-white w-full max-w-[1440px] mx-auto shadow-sm px-8">
                    <div className="max-w-7xl mx-auto">
                      {children}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </AuthLayout>
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
