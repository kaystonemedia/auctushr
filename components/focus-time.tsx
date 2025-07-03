'use client'

interface FocusTimeProps {
  focusTime: number
  totalTime: number
}

export function FocusTime({ focusTime, totalTime }: FocusTimeProps) {
  const percentage = totalTime > 0 ? (focusTime / totalTime) * 100 : 0
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>Focus Time</span>
        <span>{Math.round(percentage)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-blue-500 h-2 rounded-full" 
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
      <div className="text-xs text-gray-500">
        {Math.round(focusTime / 60)}h {Math.round(focusTime % 60)}m of {Math.round(totalTime / 60)}h {Math.round(totalTime % 60)}m
      </div>
    </div>
  )
} 