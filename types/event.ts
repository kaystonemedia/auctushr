import { Timestamp } from 'firebase/firestore'

export interface Event {
  id: string
  title: string
  description: string
  startTime: Timestamp
  endTime: Timestamp
  type: 'meeting' | 'deadline' | 'other'
  attendees: string[]
  organizer: string
  location?: string
  createdAt: Timestamp
  updatedAt: Timestamp
} 