'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useNewAuth } from '@/contexts/new-auth-context'
import { Loader2 } from 'lucide-react'

export default function Home() {
  const { user, isLoading } = useNewAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.push('/dashboard')
      } else {
        router.push('/auth/sign-in')
      }
    }
  }, [user, isLoading, router])

  return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}


