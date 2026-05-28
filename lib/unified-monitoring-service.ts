import { db } from './firebase'
import { collection, doc, addDoc, updateDoc, query, where, getDocs, Timestamp, orderBy, getDoc, setDoc } from '@/lib/data/firestore'
import { ProductivityService } from './productivity'
import { PerformanceService } from './performance-service'

export interface UnifiedActivityData {
  id: string
  userId: string
  timestamp: Date
  source: 'desktop' | 'browser' | 'mobile'
  type: 'screenshot' | 'activity' | 'focus' | 'meeting' | 'break' | 'idle'
  data: {
    // Desktop-specific data
    screenshot?: {
      dataUrl: string
      storagePath: string
      activeWindow?: {
        title: string
        owner: string
        url?: string
      }
    }
    // Browser-specific data
    browser?: {
      url: string
      title: string
      domain: string
      productiveTime: number
      idleTime: number
    }
    // Activity data
    activity?: {
      type: string
      duration: number
      productivityScore: number
    }
    // Focus session data
    focus?: {
      taskId: string
      duration: number
      interruptions: number
      completed: boolean
    }
    // Meeting data
    meeting?: {
      title: string
      participants: string[]
      duration: number
      efficiency: number
    }
  }
  workStatus: 'working' | 'break' | 'meeting' | 'idle'
  location?: {
    latitude: number
    longitude: number
    accuracy: number
  }
  deviceInfo?: {
    platform: string
    userAgent: string
    screenResolution: string
  }
  metadata: {
    sessionId: string
    syncTime: Date
    version: string
  }
}

export interface UnifiedProductivityMetrics {
  userId: string
  date: Date
  totalActiveTime: number // minutes
  totalIdleTime: number // minutes
  totalBreakTime: number // minutes
  totalMeetingTime: number // minutes
  totalFocusTime: number // minutes
  productivityScore: number // 0-100
  screenshots: number
  activities: number
  focusSessions: number
  meetings: number
  tasksCompleted: number
  topApplications: Array<{
    name: string
    time: number
    productivityScore: number
  }>
  topWebsites: Array<{
    domain: string
    time: number
    productivityScore: number
  }>
  locationData: Array<{
    latitude: number
    longitude: number
    timestamp: Date
  }>
  flags: Array<{
    type: string
    severity: 'low' | 'medium' | 'high'
    message: string
    timestamp: Date
  }>
}

export class UnifiedMonitoringService {
  private static instance: UnifiedMonitoringService
  private productivityService: ProductivityService
  private performanceService: PerformanceService

  private constructor() {
    this.productivityService = ProductivityService.getInstance({}, {})
    this.performanceService = new PerformanceService()
  }

  public static getInstance(): UnifiedMonitoringService {
    if (!UnifiedMonitoringService.instance) {
      UnifiedMonitoringService.instance = new UnifiedMonitoringService()
    }
    return UnifiedMonitoringService.instance
  }

  // ========== DATA INTEGRATION ==========

  async integrateDesktopData(
    userId: string,
    screenshots: any[],
    activityData: any[],
    syncTime: Date
  ): Promise<void> {
    try {
      const sessionId = `desktop_${Date.now()}`
      
      // Process screenshots
      for (const screenshot of screenshots) {
        await this.saveUnifiedActivity({
          id: screenshot.id,
          userId,
          timestamp: new Date(screenshot.timestamp),
          source: 'desktop',
          type: 'screenshot',
          data: {
            screenshot: {
              dataUrl: screenshot.dataUrl,
              storagePath: `screenshots/${userId}/${screenshot.id}.png`,
              activeWindow: screenshot.activeWindow
            }
          },
          workStatus: screenshot.workStatus || 'working',
          metadata: {
            sessionId,
            syncTime,
            version: '1.0'
          }
        })
      }

      // Process activity data
      for (const activity of activityData) {
        await this.saveUnifiedActivity({
          id: `activity_${Date.now()}_${Math.random()}`,
          userId,
          timestamp: new Date(activity.timestamp),
          source: 'desktop',
          type: 'activity',
          data: {
            activity: {
              type: 'window_change',
              duration: activity.idleTime || 0,
              productivityScore: this.calculateProductivityScore(activity)
            }
          },
          workStatus: activity.workStatus || 'working',
          metadata: {
            sessionId,
            syncTime,
            version: '1.0'
          }
        })
      }

      // Update daily metrics
      await this.updateDailyMetrics(userId, new Date())
    } catch (error) {
      console.error('Error integrating desktop data:', error)
      throw error
    }
  }

  async integrateBrowserData(
    userId: string,
    browserData: any[],
    syncTime: Date
  ): Promise<void> {
    try {
      const sessionId = `browser_${Date.now()}`
      
      for (const activity of browserData) {
        await this.saveUnifiedActivity({
          id: `browser_${Date.now()}_${Math.random()}`,
          userId,
          timestamp: new Date(activity.timestamp),
          source: 'browser',
          type: 'activity',
          data: {
            browser: {
              url: activity.url,
              title: activity.title,
              domain: activity.domain,
              productiveTime: activity.productiveTime || 0,
              idleTime: activity.idleTime || 0
            }
          },
          workStatus: activity.workStatus || 'working',
          metadata: {
            sessionId,
            syncTime,
            version: '1.0'
          }
        })
      }

      // Update daily metrics
      await this.updateDailyMetrics(userId, new Date())
    } catch (error) {
      console.error('Error integrating browser data:', error)
      throw error
    }
  }

  // ========== UNIFIED ACTIVITY SAVING ==========

  private async saveUnifiedActivity(activity: UnifiedActivityData): Promise<void> {
    const activityRef = collection(db, 'unified_activities')
    await addDoc(activityRef, {
      ...activity,
      timestamp: Timestamp.fromDate(activity.timestamp),
      metadata: {
        ...activity.metadata,
        syncTime: Timestamp.fromDate(activity.metadata.syncTime)
      }
    })
  }

  // ========== DAILY METRICS CALCULATION ==========

  private async updateDailyMetrics(userId: string, date: Date): Promise<void> {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    // Get all activities for the day
    const activitiesRef = collection(db, 'unified_activities')
    const q = query(
      activitiesRef,
      where('userId', '==', userId),
      where('timestamp', '>=', Timestamp.fromDate(startOfDay)),
      where('timestamp', '<=', Timestamp.fromDate(endOfDay)),
      orderBy('timestamp', 'asc')
    )

    const snapshot = await getDocs(q)
    const activities = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp.toDate()
    }))

    // Calculate metrics
    const metrics = this.calculateDailyMetrics(activities)
    
    // Save to unified_metrics collection
    const metricsRef = doc(db, 'unified_metrics', `${userId}_${date.toISOString().split('T')[0]}`)
    await setDoc(metricsRef, {
      userId,
      date: Timestamp.fromDate(date),
      ...metrics,
      updatedAt: Timestamp.now()
    }, { merge: true })

    // Update productivity service
    await this.updateProductivityService(userId, date, metrics)
  }

  private calculateDailyMetrics(activities: any[]): Partial<UnifiedProductivityMetrics> {
    let totalActiveTime = 0
    let totalIdleTime = 0
    let totalBreakTime = 0
    let totalMeetingTime = 0
    let totalFocusTime = 0
    let screenshots = 0
    let activityCount = 0
    let focusSessions = 0
    let meetings = 0
    let tasksCompleted = 0

    const applicationUsage = new Map<string, number>()
    const websiteUsage = new Map<string, number>()
    const locationData: Array<{ latitude: number; longitude: number; timestamp: Date }> = []
    const flags: Array<{ type: string; severity: 'low' | 'medium' | 'high'; message: string; timestamp: Date }> = []

    for (const activity of activities) {
      switch (activity.type) {
        case 'screenshot':
          screenshots++
          break
        case 'activity':
          activityCount++
          if (activity.data?.browser) {
            const domain = activity.data.browser.domain
            websiteUsage.set(domain, (websiteUsage.get(domain) || 0) + activity.data.browser.productiveTime)
          }
          if (activity.data?.activity) {
            totalActiveTime += activity.data.activity.duration
          }
          break
        case 'focus':
          focusSessions++
          totalFocusTime += activity.data?.focus?.duration || 0
          break
        case 'meeting':
          meetings++
          totalMeetingTime += activity.data?.meeting?.duration || 0
          break
        case 'break':
          totalBreakTime += activity.data?.activity?.duration || 0
          break
        case 'idle':
          totalIdleTime += activity.data?.activity?.duration || 0
          break
      }

      // Track application usage (desktop)
      if (activity.source === 'desktop' && activity.data?.screenshot?.activeWindow) {
        const appName = activity.data.screenshot.activeWindow.owner
        applicationUsage.set(appName, (applicationUsage.get(appName) || 0) + 1)
      }

      // Collect location data
      if (activity.location) {
        locationData.push(activity.location)
      }

      // Collect flags
      if (activity.flags) {
        flags.push(...activity.flags)
      }
    }

    // Calculate productivity score
    const totalTime = totalActiveTime + totalIdleTime + totalBreakTime + totalMeetingTime + totalFocusTime
    const productivityScore = totalTime > 0 ? 
      ((totalActiveTime + totalFocusTime + totalMeetingTime) / totalTime) * 100 : 0

    // Convert maps to arrays
    const topApplications = Array.from(applicationUsage.entries())
      .map(([name, time]) => ({ name, time, productivityScore: this.calculateAppProductivityScore(name, time) }))
      .sort((a, b) => b.time - a.time)
      .slice(0, 10)

    const topWebsites = Array.from(websiteUsage.entries())
      .map(([domain, time]) => ({ domain, time, productivityScore: this.calculateWebsiteProductivityScore(domain, time) }))
      .sort((a, b) => b.time - a.time)
      .slice(0, 10)

    return {
      totalActiveTime,
      totalIdleTime,
      totalBreakTime,
      totalMeetingTime,
      totalFocusTime,
      productivityScore,
      screenshots,
      activities: activityCount,
      focusSessions,
      meetings,
      tasksCompleted,
      topApplications,
      topWebsites,
      locationData,
      flags
    }
  }

  // ========== PRODUCTIVITY SCORE CALCULATIONS ==========

  private calculateProductivityScore(activity: any): number {
    // Base score on activity type and duration
    let score = 50 // Base score

    if (activity.workStatus === 'working') {
      score += 20
    } else if (activity.workStatus === 'break') {
      score -= 10
    } else if (activity.workStatus === 'meeting') {
      score += 15
    }

    // Adjust based on idle time
    if (activity.idleTime > 300000) { // 5 minutes
      score -= 10
    }

    return Math.max(0, Math.min(100, score))
  }

  private calculateAppProductivityScore(appName: string, time: number): number {
    // Define productive applications
    const productiveApps = [
      'code', 'visual studio', 'intellij', 'sublime', 'atom', 'vscode',
      'excel', 'word', 'powerpoint', 'outlook', 'teams', 'slack',
      'chrome', 'firefox', 'safari', 'edge'
    ]

    const isProductive = productiveApps.some(app => 
      appName.toLowerCase().includes(app)
    )

    return isProductive ? 80 : 40
  }

  private calculateWebsiteProductivityScore(domain: string, time: number): number {
    // Define productive domains
    const productiveDomains = [
      'github.com', 'stackoverflow.com', 'docs.google.com',
      'notion.so', 'figma.com', 'miro.com', 'trello.com',
      'asana.com', 'jira.com', 'confluence.atlassian.com'
    ]

    const isProductive = productiveDomains.some(prodDomain => 
      domain.includes(prodDomain)
    )

    return isProductive ? 75 : 30
  }

  // ========== PRODUCTIVITY SERVICE INTEGRATION ==========

  private async updateProductivityService(
    userId: string,
    date: Date,
    metrics: Partial<UnifiedProductivityMetrics>
  ): Promise<void> {
    // Update focus sessions
    if (metrics.totalFocusTime > 0) {
      await this.productivityService.trackFocusSession(userId, {
        startTime: new Date(date.getTime() - metrics.totalFocusTime * 60000),
        endTime: date,
        duration: metrics.totalFocusTime,
        completed: true,
        interruptions: 0
      })
    }

    // Update meeting data if available
    if (metrics.totalMeetingTime > 0) {
      await this.productivityService.trackMeeting(userId, {
        startTime: new Date(date.getTime() - metrics.totalMeetingTime * 60000),
        endTime: date,
        duration: metrics.totalMeetingTime,
        type: 'general',
        participants: [],
        agenda: 'Tracked meeting',
        outcomes: []
      })
    }
  }

  // ========== ANALYTICS AND REPORTING ==========

  async getUnifiedAnalytics(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const metricsRef = collection(db, 'unified_metrics')
    const q = query(
      metricsRef,
      where('userId', '==', userId),
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<=', Timestamp.fromDate(endDate)),
      orderBy('date', 'asc')
    )

    const snapshot = await getDocs(q)
    const metrics = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date.toDate()
    }))

    return {
      totalDays: metrics.length,
      averageProductivityScore: metrics.reduce((sum, m) => sum + m.productivityScore, 0) / metrics.length,
      totalActiveTime: metrics.reduce((sum, m) => sum + m.totalActiveTime, 0),
      totalFocusTime: metrics.reduce((sum, m) => sum + m.totalFocusTime, 0),
      totalMeetingTime: metrics.reduce((sum, m) => sum + m.totalMeetingTime, 0),
      totalScreenshots: metrics.reduce((sum, m) => sum + m.screenshots, 0),
      dailyMetrics: metrics
    }
  }

  // ========== PERFORMANCE INTEGRATION ==========

  async integrateWithPerformanceReview(
    userId: string,
    reviewId: string
  ): Promise<{ productivityScore: number; attendanceScore: number }> {
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000) // Last 90 days

    const analytics = await this.getUnifiedAnalytics(userId, startDate, endDate)
    
    const productivityScore = analytics.averageProductivityScore
    const attendanceScore = this.calculateAttendanceScore(analytics)

    return { productivityScore, attendanceScore }
  }

  private calculateAttendanceScore(analytics: any): number {
    const totalDays = analytics.totalDays
    const activeDays = analytics.dailyMetrics.filter((m: any) => m.totalActiveTime > 0).length
    
    return totalDays > 0 ? (activeDays / totalDays) * 100 : 0
  }
} 