'use client';

import { useState } from 'react';
import { createTestUser, signIn, signOut } from '@/lib/firebase';

export default function TestAuthPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  const handleCreateTestUser = async () => {
    setLoading(true);
    try {
      await createTestUser();
      setResult('Test user created successfully');
    } catch (error) {
      setResult(`Create test user error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    setLoading(true);
    try {
      await signIn('test@example.com', 'password123');
      setResult('Signed in successfully');
    } catch (error) {
      setResult(`Sign in error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut();
      setResult('Signed out successfully');
    } catch (error) {
      setResult(`Sign out error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Test Auth</h1>
      <div className="space-y-4">
        <button
          onClick={handleCreateTestUser}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          Create Test User
        </button>
        <button
          onClick={handleSignIn}
          disabled={loading}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          Sign In
        </button>
        <button
          onClick={handleSignOut}
          disabled={loading}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
        >
          Sign Out
        </button>
        {loading && <div>Loading...</div>}
        {result && <div className="mt-4 p-4 bg-gray-100 rounded">{result}</div>}
      </div>
    </div>
  );
} 