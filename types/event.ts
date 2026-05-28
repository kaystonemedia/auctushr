export interface Event {
  id: string
  title: string
  description: string
  startTime: Date
  endTime: Date
  type: 'meeting' | 'deadline' | 'other'
  attendees: string[]
  organizer: string
  location?: string
  createdAt: Date
  updatedAt: Date
} 