'use client'

interface MeetingStatsProps {
  meetings: Array<{
    title: string
    startTime: string
    endTime: string
    duration: number
  }>
}

export function MeetingStats({ meetings }: MeetingStatsProps) {
  return (
    <div className="space-y-3">
      {meetings.map((meeting, index) => (
        <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
          <div className="flex-1">
            <div className="font-medium">{meeting.title}</div>
            <div className="text-sm text-gray-500">
              {meeting.startTime} - {meeting.endTime}
            </div>
          </div>
          <div className="text-sm font-medium">
            {Math.round(meeting.duration / 60)}m
          </div>
        </div>
      ))}
      {meetings.length === 0 && (
        <div className="text-center text-gray-500 py-4">
          No meetings scheduled
        </div>
      )}
    </div>
  )
} 