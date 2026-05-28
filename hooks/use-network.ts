import { useState, useEffect } from 'react'

export function useNetwork() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [retryCount, setRetryCount] = useState(0)
  const MAX_RETRIES = 3

  const retryConnection = async () => {
    if (retryCount >= MAX_RETRIES) {
      return false
    }

    setRetryCount((prev) => prev + 1)
    setIsOnline(navigator.onLine)
    return navigator.onLine
  }

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setRetryCount(0)
    }

    const handleOffline = () => {
      setIsOnline(false)
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