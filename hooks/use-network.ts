import { useState, useEffect } from 'react'
import { db } from '@/lib/firebase'
import { enableNetwork, disableNetwork } from 'firebase/firestore'

export function useNetwork() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [retryCount, setRetryCount] = useState(0)
  const MAX_RETRIES = 3

  const retryConnection = async () => {
    if (retryCount >= MAX_RETRIES) {
      return false
    }

    setRetryCount((prev) => prev + 1)
    try {
      await enableNetwork(db)
      setIsOnline(true)
      return true
    } catch (err) {
      console.error("Error retrying connection:", err)
      return false
    }
  }

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true)
      setRetryCount(0)
      try {
        await enableNetwork(db)
      } catch (err) {
        console.error("Error enabling network:", err)
      }
    }

    const handleOffline = async () => {
      setIsOnline(false)
      try {
        await disableNetwork(db)
      } catch (err) {
        console.error("Error disabling network:", err)
      }
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  return { isOnline, retryConnection }
} 