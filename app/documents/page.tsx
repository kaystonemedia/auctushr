"use client"

import { useNewAuth } from '@/contexts/new-auth-context'

export default function DocumentsPage() {
  const { user, isLoading } = useNewAuth()

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Access Denied</h1>
          <p className="mt-2 text-gray-600">You must be signed in to view this page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">Documents</h1>
      <p className="text-gray-700">This is the documents page. Document management features will appear here.</p>
    </div>
  )
} 