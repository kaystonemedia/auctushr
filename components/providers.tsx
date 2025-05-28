'use client'

import { NewAuthProvider } from '@/contexts/new-auth-context'
import { Toaster } from "react-hot-toast"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NewAuthProvider>
      {children}
      <Toaster position="top-right" />
    </NewAuthProvider>
  )
} 