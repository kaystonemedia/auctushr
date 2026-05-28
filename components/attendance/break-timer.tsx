'use client'

import { useState, useEffect } from 'react'
import { useNewAuth } from '@/contexts/new-auth-context'
import { Button } from '@/components/ui/button'
import { Coffee, Clock } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { BreakTime } from '@/types/attendance'

interface BreakTimerProps {
  onBreakStart?: () => void
  onBreakEnd?: () => void
}

/** Break tracking is session-local until a `breaks` table is added to Supabase. */
export function BreakTimer({ onBreakStart, onBreakEnd }: BreakTimerProps) {
  const { user } = useNewAuth()
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
      if (interval) clearInterval(interval)
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
      const breakData: BreakTime = {
        id: `local-${Date.now()}`,
        employeeId: user.id,
        date: new Date(),
        startTime: new Date(),
        type,
        status: 'active',
        approved: false,
      }
      setActiveBreak(breakData)
      onBreakStart?.()
      toast.success('Break started')
    } finally {
      setLoading(false)
    }
  }

  const endBreak = async () => {
    if (!activeBreak) return
    try {
      setLoading(true)
      setActiveBreak(null)
      setTimer(0)
      onBreakEnd?.()
      toast.success('Break ended')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Coffee className="h-5 w-5 text-orange-500" />
        <h3 className="font-medium">Break Timer</h3>
      </div>

      {activeBreak ? (
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2 text-2xl font-mono">
            <Clock className="h-6 w-6" />
            {formatTime(timer)}
          </div>
          <Button onClick={endBreak} disabled={loading} variant="destructive" className="w-full">
            End Break
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => startBreak('short_break')} disabled={loading} variant="outline">
            Short Break
          </Button>
          <Button onClick={() => startBreak('lunch')} disabled={loading} variant="outline">
            Lunch
          </Button>
        </div>
      )}
    </div>
  )
}
