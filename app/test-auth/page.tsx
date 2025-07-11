'use client';

import { useNewAuth } from '@/contexts/new-auth-context'

export default function TestAuthPage() {
  const { user, firebaseUser, isLoading } = useNewAuth()

  if (isLoading) {
    return <div className="p-6">Loading...</div>
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Authentication Test</h1>
      
      <div className="space-y-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h2 className="font-semibold mb-2">User Object:</h2>
          <pre className="text-sm bg-white p-2 rounded">
            {JSON.stringify(user, null, 2)}
          </pre>
        </div>

        <div className="bg-green-50 p-4 rounded-lg">
          <h2 className="font-semibold mb-2">Firebase User:</h2>
          <pre className="text-sm bg-white p-2 rounded">
            {JSON.stringify(firebaseUser ? {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              emailVerified: firebaseUser.emailVerified
            } : null, null, 2)}
          </pre>
        </div>

        <div className="bg-yellow-50 p-4 rounded-lg">
          <h2 className="font-semibold mb-2">Access Summary:</h2>
          <div className="text-sm space-y-1">
            <div>Logged in: {user ? 'Yes' : 'No'}</div>
            <div>Role: {user?.role || 'None'}</div>
            <div>Can access debug page: {user?.role === 'admin' ? 'Yes' : 'No'}</div>
          </div>
        </div>
      </div>
    </div>
  )
} 