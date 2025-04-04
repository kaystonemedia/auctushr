import { Timestamp } from 'firebase/firestore'

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
  breakDuration: number; // in minutes
  targetProductiveHours: number;
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