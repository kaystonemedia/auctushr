export interface PerformanceReview {
  id: string
  employeeId: string
  reviewerId: string
  reviewPeriod: {
    start: Date
    end: Date
  }
  status: 'draft' | 'pending' | 'in_progress' | 'completed' | 'cancelled'
  type: 'annual' | 'quarterly' | 'mid_year' | 'probationary' | 'project_based'
  
  // Overall Rating
  overallRating: number // 1-5 scale
  overallComments: string
  
  // KPI Scores
  kpiScores: KPIScore[]
  
  // 360 Feedback (if applicable)
  feedback360: Feedback360[]
  
  // Goals & Objectives
  previousGoals: Goal[]
  newGoals: Goal[]
  
  // Development Plan
  developmentPlan: DevelopmentPlan
  
  // Salary & Compensation Review
  salaryReview?: SalaryReview
  
  // Metadata
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
  dueDate: Date
  
  // Employee Self-Assessment
  selfAssessment?: SelfAssessment
  
  // Manager Comments
  managerComments: string
  managerRecommendations: string[]
  
  // HR Review
  hrComments?: string
  hrApproval?: boolean
  hrApprovedBy?: string
  hrApprovedAt?: Date
}

export interface KPI {
  id: string
  name: string
  description: string
  category: KPICategory
  type: KPIType
  unit: string // e.g., "percentage", "count", "hours", "dollars"
  target: number
  weight: number // percentage of total performance (0-100)
  
  // Calculation
  calculationMethod: 'manual' | 'automatic' | 'formula'
  formula?: string // for automatic calculation
  dataSource?: string // where to pull data from
  
  // Department/Role specific
  departmentId?: string
  roleId?: string
  
  // Active period
  isActive: boolean
  validFrom: Date
  validTo?: Date
  
  // Created by
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export enum KPICategory {
  PRODUCTIVITY = 'productivity',
  QUALITY = 'quality',
  CUSTOMER_SATISFACTION = 'customer_satisfaction',
  TEAMWORK = 'teamwork',
  INNOVATION = 'innovation',
  ATTENDANCE = 'attendance',
  SALES = 'sales',
  COST_MANAGEMENT = 'cost_management',
  SAFETY = 'safety',
  COMPLIANCE = 'compliance'
}

export enum KPIType {
  PERCENTAGE = 'percentage',
  NUMERIC = 'numeric',
  CURRENCY = 'currency',
  HOURS = 'hours',
  RATING = 'rating',
  BOOLEAN = 'boolean'
}

export interface KPIScore {
  id: string
  kpiId: string
  employeeId: string
  reviewId: string
  
  // Score
  actualValue: number
  targetValue: number
  score: number // calculated score (0-5)
  percentage: number // achievement percentage
  
  // Comments
  employeeComments?: string
  managerComments?: string
  
  // Evidence/Data
  evidence?: string[]
  dataPoints?: DataPoint[]
  
  // Period
  periodStart: Date
  periodEnd: Date
  
  // Metadata
  createdAt: Date
  updatedAt: Date
}

export interface DataPoint {
  date: Date
  value: number
  source: string
  notes?: string
}

export interface Feedback360 {
  id: string
  reviewId: string
  employeeId: string
  providerId: string
  providerType: 'manager' | 'peer' | 'direct_report' | 'customer' | 'self'
  
  // Ratings
  ratings: Rating[]
  
  // Comments
  strengths: string
  areasForImprovement: string
  generalComments: string
  
  // Status
  status: 'pending' | 'in_progress' | 'completed'
  isAnonymous: boolean
  
  // Metadata
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
}

export interface Rating {
  criteriaId: string
  criteriaName: string
  score: number // 1-5 scale
  comments?: string
  weight: number // percentage weight
}

export interface FeedbackCriteria {
  id: string
  name: string
  description: string
  category: string
  weight: number
  isActive: boolean
  
  // Department/Role specific
  departmentId?: string
  roleId?: string
  
  createdAt: Date
  updatedAt: Date
}

export interface Goal {
  id: string
  employeeId: string
  title: string
  description: string
  category: GoalCategory
  priority: 'low' | 'medium' | 'high'
  
  // Timeline
  startDate: Date
  targetDate: Date
  completedDate?: Date
  
  // Progress
  status: 'not_started' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold'
  progress: number // 0-100 percentage
  
  // Measurement
  measurementCriteria: string
  successMetrics: string[]
  
  // Support
  requiredResources: string[]
  supportNeeded: string[]
  
  // Review
  quarterlyReviews: QuarterlyReview[]
  
  // Relationship
  parentGoalId?: string
  linkedKPIs: string[]
  
  // Metadata
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export enum GoalCategory {
  PERFORMANCE = 'performance',
  DEVELOPMENT = 'development',
  CAREER = 'career',
  SKILL_BUILDING = 'skill_building',
  PROJECT = 'project',
  BEHAVIORAL = 'behavioral',
  LEADERSHIP = 'leadership'
}

export interface QuarterlyReview {
  id: string
  quarter: string
  progress: number
  achievements: string[]
  challenges: string[]
  nextSteps: string[]
  managerComments: string
  employeeComments: string
  reviewDate: Date
}

export interface DevelopmentPlan {
  id: string
  employeeId: string
  reviewId: string
  
  // Areas for Development
  developmentAreas: DevelopmentArea[]
  
  // Career Path
  careerGoals: string[]
  desiredRole?: string
  promotionReadiness: 'not_ready' | 'developing' | 'ready' | 'promotion_pending'
  
  // Training & Development
  trainingNeeds: TrainingNeed[]
  recommendedCourses: string[]
  mentoring: MentoringPlan
  
  // Timeline
  timeline: DevelopmentTimeline[]
  
  // Budget
  budgetRequested?: number
  budgetApproved?: number
  
  // Metadata
  createdAt: Date
  updatedAt: Date
}

export interface DevelopmentArea {
  id: string
  area: string
  currentLevel: number // 1-5
  targetLevel: number // 1-5
  importance: 'low' | 'medium' | 'high'
  actionItems: string[]
  resources: string[]
  timeline: string
}

export interface TrainingNeed {
  id: string
  skill: string
  currentLevel: number
  targetLevel: number
  trainingType: 'online' | 'classroom' | 'workshop' | 'conference' | 'certification'
  estimatedCost: number
  priority: 'low' | 'medium' | 'high'
  justification: string
}

export interface MentoringPlan {
  hasMentor: boolean
  mentorId?: string
  mentorName?: string
  mentorshipGoals: string[]
  meetingFrequency?: string
  duration?: string
}

export interface DevelopmentTimeline {
  milestone: string
  targetDate: Date
  status: 'pending' | 'in_progress' | 'completed'
  completedDate?: Date
  notes?: string
}

export interface SalaryReview {
  id: string
  employeeId: string
  reviewId: string
  
  // Current Compensation
  currentSalary: number
  currentBenefits: string[]
  
  // Recommended Changes
  recommendedSalary: number
  salaryIncrease: number
  increasePercentage: number
  
  // Justification
  performanceJustification: string
  marketAnalysis: string
  budgetImpact: number
  
  // Approval
  managerApproval: boolean
  hrApproval: boolean
  executiveApproval?: boolean
  
  // Implementation
  effectiveDate: Date
  implementationNotes: string
  
  // Metadata
  createdAt: Date
  updatedAt: Date
}

export interface SelfAssessment {
  id: string
  employeeId: string
  reviewId: string
  
  // Self Ratings
  selfRatings: Rating[]
  
  // Accomplishments
  keyAccomplishments: string[]
  goalsAchieved: string[]
  challenges: string[]
  
  // Development
  strengthsIdentified: string[]
  areasForImprovement: string[]
  developmentInterests: string[]
  
  // Goals
  proposedGoals: string[]
  careerAspirations: string[]
  
  // Support
  supportNeeded: string[]
  trainingRequests: string[]
  
  // Comments
  additionalComments: string
  
  // Metadata
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
}

export interface PerformanceAnalytics {
  // Overall Statistics
  totalReviews: number
  completedReviews: number
  averageRating: number
  
  // Ratings Distribution
  ratingDistribution: {
    rating: number
    count: number
    percentage: number
  }[]
  
  // Department Performance
  departmentPerformance: {
    departmentId: string
    departmentName: string
    averageRating: number
    employeeCount: number
    topPerformers: number
  }[]
  
  // KPI Performance
  kpiPerformance: {
    kpiId: string
    kpiName: string
    averageScore: number
    achievementRate: number
  }[]
  
  // Trends
  performanceTrends: {
    period: string
    averageRating: number
    reviewCount: number
  }[]
  
  // Top Performers
  topPerformers: {
    employeeId: string
    employeeName: string
    rating: number
    improvement: number
  }[]
  
  // Development Needs
  commonDevelopmentAreas: {
    area: string
    frequency: number
    percentage: number
  }[]
  
  // Salary Impact
  salaryImpact: {
    totalIncreases: number
    averageIncrease: number
    budgetImpact: number
  }
}

export interface PerformanceSettings {
  // Review Cycles
  reviewCycles: {
    annual: boolean
    quarterly: boolean
    midYear: boolean
    probationary: boolean
  }
  
  // Rating Scale
  ratingScale: {
    min: number
    max: number
    labels: string[]
  }
  
  // KPI Settings
  kpiSettings: {
    defaultWeight: number
    maxKPIsPerEmployee: number
    autoCalculation: boolean
  }
  
  // 360 Feedback
  feedback360Settings: {
    enabled: boolean
    anonymousAllowed: boolean
    minimumFeedbackProviders: number
    includeCustomers: boolean
  }
  
  // Notifications
  notifications: {
    reviewDueReminders: boolean
    reminderDaysBefore: number
    managerNotifications: boolean
    hrNotifications: boolean
  }
  
  // Salary Review
  salaryReviewSettings: {
    enabled: boolean
    requiresHRApproval: boolean
    requiresExecutiveApproval: boolean
    budgetThreshold: number
  }
} 