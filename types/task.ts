import { Timestamp } from 'firebase/firestore'

export interface Task {
  id: string
  title: string
  description: string
  dueDate: string | Timestamp
  priority: 'low' | 'medium' | 'high'
  status: 'pending' | 'accepted' | 'in_progress' | 'completed'
  assignedTo: string
  assignedBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
} 