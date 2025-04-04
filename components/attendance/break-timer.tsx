'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { db } from '@/lib/firebase'
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Coffee, Clock } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { BreakTime } from '@/types/attendance'

interface BreakTimerProps {
  onBreakStart?: () => void;
  onBreakEnd?: () => void;
}

export function BreakTimer({ onBreakStart, onBreakEnd }: BreakTimerProps) {
  const { user } = useAuth()
  const [activeBreak, setActiveBreak] = useState<BreakTime | null>(null)
  const [timer, setTimer] = useState<number>(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let interval: NodeJS.Timeout

    if (activeBreak) {
      interval = setInterval(() => {
        const duration = Math.floor((Date.now() - activeBreak.startTime.getTime()) / 1000)
        setTimer(duration)
      }, 1000)
    }

    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [activeBreak])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const startBreak = async (type: BreakTime['type'] = 'short_break') => {
    if (!user) return

    try {
      setLoading(true)
      const breakData: Omit<BreakTime, 'id'> = {
        employeeId: user.uid,
        date: new Date(),
        startTime: new Date(),
        type,
        status: 'active',
        approved: false
      }

      const docRef = await addDoc(collection(db, 'breaks'), breakData)
      setActiveBreak({ id: docRef.id, ...breakData })
      onBreakStart?.()
      toast.success('Break started')
    } catch (error) {
      console.error('Error starting break:', error)
      toast.error('Failed to start break')
    } finally {
      setLoading(false)
    }
  }

  const endBreak = async () => {
    if (!activeBreak || !user) return

    try {
      setLoading(true)
      const endTime = new Date()
      const duration = Math.floor((endTime.getTime() - activeBreak.startTime.getTime()) / (1000 * 60))

      await updateDoc(doc(db, 'breaks', activeBreak.id), {
        endTime,
        duration,
        status: 'completed'
      })

      setActiveBreak(null)
      setTimer(0)
      onBreakEnd?.()
      toast.success('Break ended')
    } catch (error) {
      console.error('Error ending break:', error)
      toast.error('Failed to end break')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center space-x-4">
      {!activeBreak ? (
        <>
          <Button
            onClick={() => startBreak('short_break')}
            disabled={loading}
            variant="outline"
            className="flex items-center"
          >
            <Coffee className="w-4 h-4 mr-2" />
            Take Break
          </Button>
          <Button
            onClick={() => startBreak('lunch')}
            disabled={loading}
            variant="outline"
            className="flex items-center"
          >
            <Coffee className="w-4 h-4 mr-2" />
            Lunch Break
          </Button>
        </>
      ) : (
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <Clock className="w-4 h-4 mr-2 text-yellow-500" />
            <span className="text-sm font-medium">{formatTime(timer)}</span>
          </div>
          <Button
            onClick={endBreak}
            disabled={loading}
            variant="outline"
            className="flex items-center"
          >
            End Break
          </Button>
        </div>
      )}
    </div>
  )
} 