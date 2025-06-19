import { Timestamp } from 'firebase/firestore'
import { AttendanceRecord } from './attendance'

export interface Task {
  id: string
  title: string
  description?: string
  completed: boolean
  priority: 'low' | 'medium' | 'high'
  category?: string
  timeSpent?: number // in minutes
}

export interface ProductivityLog {
  id?: string
  userId: string
  date: Timestamp
  tasks: Task[]
  notes?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface ProductivitySettings {
  trackingEnabled: boolean;
  idleThreshold: number;
  syncInterval: number;
  collectUrls: boolean;
  collectTitles: boolean;
  retentionPeriod: number;
  productiveDomains: string[];
  productiveSites: string[];
  unproductiveSites: string[];
  workingHours: {
    start: string; // HH:mm format
    end: string; // HH:mm format
  };
  breakDuration: number // minutes
  targetProductiveHours: number;
  focusSessionDuration: number // minutes
  maxFocusSessionsPerDay: number
  minFocusTimePercentage: number // percentage of workday
  maxMeetingTimePercentage: number // percentage of workday
  productivityThresholds: {
    low: number // percentage
    medium: number // percentage
    high: number // percentage
  }
  notificationPreferences: {
    focusReminders: boolean
    breakReminders: boolean
    productivityAlerts: boolean
    meetingReminders: boolean
  }
}

export interface DailyProductivityStats {
  date: string;
  totalTime: number;
  productiveTime: number;
  idleTime: number;
  sitesVisited: number;
  mostVisitedSites: {
    domain: string;
    duration: number;
    isProductive: boolean;
  }[];
  productivityScore: number;
}

export interface DailyStats {
  date: string;
  productiveTime: number;
  idleTime: number;
  totalTime: number;
  productivityScore: number;
}

export interface ProductivityReport {
  totalTasks: number
  completedTasks: number
  averageCompletionRate: number
  logs: ProductivityLog[]
}

export interface ActivityLog {
  timestamp: number;
  url: string;
  title: string;
  duration: number;
  isProductive: boolean;
  category: string;
  employeeId: string;
  departmentId: string;
}

export interface ProductivityRecord {
  id: string
  userId: string
  date: Date
  focusSessions: FocusSession[]
  meetings: Meeting[]
  productivityScore: number // 0-100
  focusTimePercentage: number // percentage of workday
  meetingTimePercentage: number // percentage of workday
  taskCompletionRate: number // percentage
  notes?: string
  tags?: string[]
  createdAt: Date
  updatedAt: Date
}

export interface TaskRecord {
  id: string
  title: string
  description?: string
  assignedTo: string
  assignedBy: string
  projectId?: string
  status: 'pending' | 'in_progress' | 'completed' | 'blocked'
  priority: 'low' | 'medium' | 'high'
  estimatedHours: number
  actualHours?: number
  startTime: Date
  endTime?: Date
  createdAt: Date
  updatedAt: Date
  tags?: string[]
  attachments?: string[]
  comments?: {
    userId: string
    text: string
    timestamp: Date
  }[]
}

export interface FocusSession {
  id: string
  userId: string
  startTime: Date
  endTime: Date
  duration: number // minutes
  completed: boolean
  interruptions: number
  notes?: string
  tags?: string[]
  createdAt: Date
  updatedAt: Date
}

export interface Meeting {
  id: string
  userId: string
  title: string
  startTime: Date
  endTime: Date
  duration: number // minutes
  type: MeetingType
  participants: string[]
  agenda: string
  outcomes: string[]
  status: MeetingStatus
  notes?: string
  tags?: string[]
  createdAt: Date
  updatedAt: Date
}

export enum MeetingType {
  ONE_ON_ONE = 'one_on_one',
  TEAM = 'team',
  PROJECT = 'project',
  CLIENT = 'client',
  INTERVIEW = 'interview',
  OTHER = 'other'
}

export enum MeetingStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  RESCHEDULED = 'rescheduled'
}

export interface Project {
  id: string
  name: string
  description?: string
  manager: string
  team: string[]
  startDate: Date
  endDate?: Date
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high'
  progress: number // percentage
  tasks: string[] // task IDs
  createdAt: Date
  updatedAt: Date
}

export interface ProductivityAnalytics {
  overview: {
    averageProductivityScore: number
    taskCompletionRate: number
    focusTimePercentage: number
    meetingEfficiency: number
    totalFocusSessions: number
    totalTasksCompleted: number
    totalMeetingHours: number
  }
  trends: {
    daily: {
      date: Date
      productivityScore: number
      focusTime: number
      meetingTime: number
      tasksCompleted: number
    }[]
    weekly: {
      weekStart: Date
      averageProductivity: number
      tasksCompleted: number
      focusTimePercentage: number
      meetingEfficiency: number
    }[]
    monthly: {
      month: Date
      productivityScore: number
      focusTimePercentage: number
      meetingEfficiency: number
      tasksCompleted: number
    }[]
  }
  projectWise: {
    projectId: string
    projectName: string
    productivityScore: number
    taskCompletion: number
    timeAllocation: number // hours
  }[]
  teamStats: {
    employeeId: string
    name: string
    productivityScore: number
    focusTime: number // minutes
    meetingTime: number // minutes
    tasksCompleted: number
  }[]
}

export interface ProductivityFilters {
  startDate?: Date
  endDate?: Date
  employeeId?: string
  department?: string
  projectId?: string
  taskStatus?: TaskRecord['status']
  minProductivityScore?: number
  maxProductivityScore?: number
  search?: string
}

export interface ProductivityInsights {
  dailyTrends: {
    date: Date
    productivityScore: number
    focusTimePercentage: number
    meetingTimePercentage: number
    taskCompletionRate: number
  }[]
  weeklyTrends: {
    weekStart: Date
    weekEnd: Date
    averageProductivityScore: number
    averageFocusTimePercentage: number
    averageMeetingTimePercentage: number
    averageTaskCompletionRate: number
  }[]
  monthlyTrends: {
    month: number
    year: number
    averageProductivityScore: number
    averageFocusTimePercentage: number
    averageMeetingTimePercentage: number
    averageTaskCompletionRate: number
  }[]
  focusSessionPatterns: {
    mostProductiveTimeOfDay: string
    averageSessionDuration: number
    completionRate: number
    interruptionRate: number
  }
  meetingImpact: {
    averageMeetingDuration: number
    meetingEfficiencyScore: number
    mostCommonMeetingType: MeetingType
    participantEngagementScore: number
  }
  recommendations: {
    focusTimeOptimization: string[]
    meetingEfficiency: string[]
    productivityImprovement: string[]
  }
} 