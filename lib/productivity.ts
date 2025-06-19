import { db } from './firebase'
import { collection, doc, addDoc, updateDoc, query, where, getDocs, Timestamp, orderBy, getDoc, setDoc } from 'firebase/firestore'
import { 
  ProductivityRecord, 
  TaskRecord, 
  FocusSession, 
  MeetingRecord, 
  Project,
  ProductivitySettings,
  ProductivityAnalytics
} from '@/types/productivity'
import { AttendanceRecord } from '@/types/attendance'

export class ProductivityService {
  private static instance: ProductivityService
  private settings: ProductivitySettings
  private defaultSettings: ProductivitySettings

  private constructor(settings: ProductivitySettings, defaultSettings: ProductivitySettings) {
    this.settings = settings
    this.defaultSettings = defaultSettings
  }

  public static getInstance(settings: ProductivitySettings, defaultSettings: ProductivitySettings): ProductivityService {
    if (!ProductivityService.instance) {
      ProductivityService.instance = new ProductivityService(settings, defaultSettings)
    }
    return ProductivityService.instance
  }

  // Task Management
  async createTask(task: Omit<TaskRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<TaskRecord> {
    const taskData = {
      ...task,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    }

    const docRef = await addDoc(collection(db, 'tasks'), taskData)
    return {
      id: docRef.id,
      ...taskData,
      createdAt: taskData.createdAt.toDate(),
      updatedAt: taskData.updatedAt.toDate()
    }
  }

  async updateTask(taskId: string, updates: Partial<TaskRecord>): Promise<void> {
    const taskRef = doc(db, 'tasks', taskId)
    await updateDoc(taskRef, {
      ...updates,
      updatedAt: Timestamp.now()
    })
  }

  // Focus Session Management
  async startFocusSession(taskId: string, employeeId: string): Promise<FocusSession> {
    const session: Omit<FocusSession, 'id' | 'createdAt' | 'updatedAt'> = {
      taskId,
      startTime: new Date(),
      status: 'active',
      interruptions: [],
      productivityScore: 0
    }

    const docRef = await addDoc(collection(db, 'focusSessions'), {
      ...session,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    })

    return {
      id: docRef.id,
      ...session
    }
  }

  async endFocusSession(sessionId: string, notes?: string): Promise<void> {
    const sessionRef = doc(db, 'focusSessions', sessionId)
    const sessionDoc = await getDoc(sessionRef)
    if (!sessionDoc.exists()) {
      throw new Error('Focus session not found')
    }
    const session = sessionDoc.data() as FocusSession

    const endTime = new Date()
    const duration = (endTime.getTime() - session.startTime.getTime()) / (1000 * 60) // in minutes
    const productivityScore = this.calculateFocusSessionScore(session, duration)

    await updateDoc(sessionRef, {
      endTime: Timestamp.fromDate(endTime),
      duration,
      status: 'completed',
      productivityScore,
      notes,
      updatedAt: Timestamp.now()
    })

    // Update task progress
    if (session.taskId) {
      await this.updateTaskProgress(session.taskId, duration)
    }
  }

  // Meeting Management
  async createMeeting(meeting: Omit<MeetingRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<MeetingRecord> {
    const meetingData = {
      ...meeting,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    }

    const docRef = await addDoc(collection(db, 'meetings'), meetingData)
    return {
      id: docRef.id,
      ...meetingData,
      createdAt: meetingData.createdAt.toDate(),
      updatedAt: meetingData.updatedAt.toDate()
    }
  }

  async updateMeetingEfficiency(meetingId: string, efficiency: number, outcomes?: string[]): Promise<void> {
    const meetingRef = doc(db, 'meetings', meetingId)
    await updateDoc(meetingRef, {
      efficiency,
      outcomes,
      updatedAt: Timestamp.now()
    })
  }

  // Productivity Calculations
  private calculateFocusSessionScore(session: FocusSession, duration: number): number {
    const baseScore = 100
    const interruptionPenalty = session.interruptions.reduce((total, interruption) => {
      return total + (interruption.duration / duration) * 20 // 20% penalty per interruption
    }, 0)

    const durationScore = Math.min(duration / this.settings.focusSessionDuration, 1) * 30 // 30% of score based on duration
    const interruptionScore = Math.max(0, 70 - interruptionPenalty) // 70% of score based on interruptions

    return Math.round(durationScore + interruptionScore)
  }

  private async updateTaskProgress(taskId: string, focusDuration: number): Promise<void> {
    const taskRef = doc(db, 'tasks', taskId)
    const taskDoc = await getDoc(taskRef)
    if (!taskDoc.exists()) {
      throw new Error('Task not found')
    }
    const task = taskDoc.data() as TaskRecord

    const actualHours = (task.actualHours || 0) + (focusDuration / 60)
    const progress = Math.min((actualHours / task.estimatedHours) * 100, 100)
    const status = progress >= 100 ? 'completed' : 'in_progress'

    await updateDoc(taskRef, {
      actualHours,
      status,
      updatedAt: Timestamp.now()
    })
  }

  // Analytics
  async calculateProductivityAnalytics(
    employeeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ProductivityAnalytics> {
    const analytics: ProductivityAnalytics = {
      overview: {
        averageProductivityScore: 0,
        taskCompletionRate: 0,
        focusTimePercentage: 0,
        meetingEfficiency: 0,
        totalFocusSessions: 0,
        totalTasksCompleted: 0,
        totalMeetingHours: 0
      },
      trends: {
        daily: [],
        weekly: [],
        monthly: []
      },
      projectWise: [],
      teamStats: []
    }

    // Fetch all relevant records
    const [tasks, focusSessions, meetings] = await Promise.all([
      this.getTasks(employeeId, startDate, endDate),
      this.getFocusSessions(employeeId, startDate, endDate),
      this.getMeetings(employeeId, startDate, endDate)
    ])

    // Calculate overview metrics
    analytics.overview = {
      averageProductivityScore: this.calculateAverageProductivityScore(focusSessions),
      taskCompletionRate: this.calculateTaskCompletionRate(tasks),
      focusTimePercentage: this.calculateFocusTimePercentage(focusSessions, startDate, endDate),
      meetingEfficiency: this.calculateMeetingEfficiency(meetings),
      totalFocusSessions: focusSessions.length,
      totalTasksCompleted: tasks.filter(t => t.status === 'completed').length,
      totalMeetingHours: meetings.reduce((total, m) => total + m.duration, 0) / 60
    }

    // Calculate trends
    analytics.trends = this.calculateTrends(tasks, focusSessions, meetings, startDate, endDate)

    // Calculate project-wise metrics
    analytics.projectWise = await this.calculateProjectMetrics(tasks, employeeId)

    // Calculate team stats
    analytics.teamStats = await this.calculateTeamStats(employeeId, startDate, endDate)

    return analytics
  }

  private async getTasks(employeeId: string, startDate: Date, endDate: Date): Promise<TaskRecord[]> {
    if (!employeeId) {
      throw new Error('Employee ID is required')
    }
    if (!startDate || !endDate) {
      throw new Error('Start date and end date are required')
    }

    const q = query(
      collection(db, 'tasks'),
      where('assignedTo', '==', employeeId),
      where('startTime', '>=', Timestamp.fromDate(startDate)),
      where('startTime', '<=', Timestamp.fromDate(endDate)),
      orderBy('startTime', 'asc')
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      startTime: doc.data().startTime.toDate(),
      endTime: doc.data().endTime?.toDate(),
      createdAt: doc.data().createdAt.toDate(),
      updatedAt: doc.data().updatedAt.toDate()
    })) as TaskRecord[]
  }

  private async getFocusSessions(employeeId: string, startDate: Date, endDate: Date): Promise<FocusSession[]> {
    if (!employeeId) {
      throw new Error('Employee ID is required')
    }
    if (!startDate || !endDate) {
      throw new Error('Start date and end date are required')
    }

    const q = query(
      collection(db, 'focusSessions'),
      where('userId', '==', employeeId), // Changed from employeeId to userId to match schema
      where('startTime', '>=', Timestamp.fromDate(startDate)),
      where('startTime', '<=', Timestamp.fromDate(endDate)),
      orderBy('startTime', 'asc')
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      startTime: doc.data().startTime.toDate(),
      endTime: doc.data().endTime?.toDate(),
      createdAt: doc.data().createdAt.toDate(),
      updatedAt: doc.data().updatedAt.toDate()
    })) as FocusSession[]
  }

  private async getMeetings(employeeId: string, startDate: Date, endDate: Date): Promise<MeetingRecord[]> {
    if (!employeeId) {
      throw new Error('Employee ID is required')
    }
    if (!startDate || !endDate) {
      throw new Error('Start date and end date are required')
    }

    const q = query(
      collection(db, 'meetings'),
      where('participants', 'array-contains', employeeId), // Store participant IDs as strings
      where('startTime', '>=', Timestamp.fromDate(startDate)),
      where('startTime', '<=', Timestamp.fromDate(endDate)),
      orderBy('startTime', 'asc')
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      startTime: doc.data().startTime.toDate(),
      endTime: doc.data().endTime.toDate(),
      createdAt: doc.data().createdAt.toDate(),
      updatedAt: doc.data().updatedAt.toDate()
    })) as MeetingRecord[]
  }

  private calculateAverageProductivityScore(sessions: FocusSession[]): number {
    if (sessions.length === 0) return 0
    const total = sessions.reduce((sum, session) => sum + session.productivityScore, 0)
    return Math.round(total / sessions.length)
  }

  private calculateTaskCompletionRate(tasks: TaskRecord[]): number {
    if (tasks.length === 0) return 0
    const completed = tasks.filter(t => t.status === 'completed').length
    return Math.round((completed / tasks.length) * 100)
  }

  private calculateFocusTimePercentage(sessions: FocusSession[], startDate: Date, endDate: Date): number {
    const totalMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60)
    const focusMinutes = sessions.reduce((total, session) => total + session.duration, 0)
    return Math.round((focusMinutes / totalMinutes) * 100)
  }

  private calculateMeetingEfficiency(meetings: MeetingRecord[]): number {
    if (meetings.length === 0) return 0
    const total = meetings.reduce((sum, meeting) => sum + meeting.efficiency, 0)
    return Math.round(total / meetings.length)
  }

  private calculateTrends(
    tasks: TaskRecord[],
    sessions: FocusSession[],
    meetings: MeetingRecord[],
    startDate: Date,
    endDate: Date
  ): ProductivityAnalytics['trends'] {
    const trends: ProductivityAnalytics['trends'] = {
      daily: [],
      weekly: [],
      monthly: []
    }

    // Calculate daily trends
    const currentDate = new Date(startDate)
    while (currentDate <= endDate) {
      const dayTasks = tasks.filter(t => 
        t.startTime.toDateString() === currentDate.toDateString()
      )
      const daySessions = sessions.filter(s => 
        s.startTime.toDateString() === currentDate.toDateString()
      )
      const dayMeetings = meetings.filter(m => 
        m.startTime.toDateString() === currentDate.toDateString()
      )

      trends.daily.push({
        date: new Date(currentDate),
        productivityScore: this.calculateAverageProductivityScore(daySessions),
        focusTime: daySessions.reduce((total, s) => total + s.duration, 0),
        meetingTime: dayMeetings.reduce((total, m) => total + m.duration, 0),
        tasksCompleted: dayTasks.filter(t => t.status === 'completed').length
      })

      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Calculate weekly and monthly trends similarly
    // ... (implementation omitted for brevity)

    return trends
  }

  private async calculateProjectMetrics(
    tasks: TaskRecord[],
    employeeId: string
  ): Promise<ProductivityAnalytics['projectWise']> {
    if (!employeeId) {
      throw new Error('Employee ID is required')
    }

    const projectIds = [...new Set(tasks.map(t => t.projectId).filter(Boolean))]
    const metrics: ProductivityAnalytics['projectWise'] = []

    for (const projectId of projectIds) {
      if (!projectId) continue // Skip if projectId is undefined

      const projectTasks = tasks.filter(t => t.projectId === projectId)
      const projectDoc = await getDoc(doc(db, 'projects', projectId))
      
      if (!projectDoc.exists()) {
        console.warn(`Project ${projectId} not found`)
        continue
      }

      const project = projectDoc.data()
      metrics.push({
        projectId,
        projectName: project.name || 'Unnamed Project',
        timeAllocation: this.calculateProjectTimeAllocation(projectTasks),
        taskCompletion: this.calculateTaskCompletionRate(projectTasks),
        productivityScore: this.calculateProjectProductivityScore(projectTasks)
      })
    }

    return metrics
  }

  private calculateProjectTimeAllocation(tasks: TaskRecord[]): number {
    const totalHours = tasks.reduce((total, task) => total + task.actualHours, 0)
    return Math.round(totalHours)
  }

  private calculateProjectProductivityScore(tasks: TaskRecord[]): number {
    if (tasks.length === 0) return 0
    const completionRate = this.calculateTaskCompletionRate(tasks)
    const timeEfficiency = tasks.reduce((total, task) => {
      if (task.actualHours && task.estimatedHours) {
        return total + (task.estimatedHours / task.actualHours) * 100
      }
      return total
    }, 0) / tasks.length

    return Math.round((completionRate + timeEfficiency) / 2)
  }

  private async calculateTeamStats(
    employeeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ProductivityAnalytics['teamStats']> {
    if (!employeeId) {
      throw new Error('Employee ID is required')
    }
    if (!startDate || !endDate) {
      throw new Error('Start date and end date are required')
    }

    // Get employee's department
    const employeeDoc = await getDoc(doc(db, 'users', employeeId))
    if (!employeeDoc.exists()) {
      throw new Error('Employee not found')
    }

    const employee = employeeDoc.data()
    const department = employee.department

    if (!department) {
      throw new Error('Employee department not found')
    }

    // Get all employees in the same department
    const teamDocs = await getDocs(query(
      collection(db, 'users'),
      where('department', '==', department)
    ))

    const teamStats: ProductivityAnalytics['teamStats'] = []

    for (const doc of teamDocs.docs) {
      const teamMember = doc.data()
      if (!teamMember.id) continue // Skip if no ID

      const [tasks, sessions, meetings] = await Promise.all([
        this.getTasks(teamMember.id, startDate, endDate),
        this.getFocusSessions(teamMember.id, startDate, endDate),
        this.getMeetings(teamMember.id, startDate, endDate)
      ])

      teamStats.push({
        employeeId: teamMember.id,
        name: teamMember.name || 'Unknown',
        productivityScore: this.calculateAverageProductivityScore(sessions),
        focusTime: sessions.reduce((total, s) => total + (s.duration || 0), 0),
        meetingTime: meetings.reduce((total, m) => total + (m.duration || 0), 0),
        tasksCompleted: tasks.filter(t => t.status === 'completed').length
      })
    }

    return teamStats
  }

  async getUserSettings(userId: string): Promise<ProductivitySettings> {
    try {
      const settingsRef = doc(db, 'users', userId, 'settings', 'productivity')
      const settingsDoc = await getDoc(settingsRef)

      if (settingsDoc.exists()) {
        return settingsDoc.data() as ProductivitySettings
      }

      // If settings don't exist, create with defaults
      await this.updateUserSettings(userId, this.defaultSettings)
      return this.defaultSettings
    } catch (error) {
      console.error('Error fetching user settings:', error)
      throw error
    }
  }

  async updateUserSettings(userId: string, settings: ProductivitySettings): Promise<void> {
    try {
      const settingsRef = doc(db, 'users', userId, 'settings', 'productivity')
      await setDoc(settingsRef, settings, { merge: true })
    } catch (error) {
      console.error('Error updating user settings:', error)
      throw error
    }
  }

  async calculateProductivityScore(userId: string, date: Date): Promise<number> {
    // TODO: Implement productivity score calculation based on:
    // - Focus session completion rate
    // - Meeting attendance and participation
    // - Task completion rate
    // - Time spent in focus vs meetings
    // - Adherence to user's productivity settings
    return 0
  }

  async getProductivityInsights(userId: string, startDate: Date, endDate: Date): Promise<any> {
    // TODO: Implement productivity insights generation
    // - Daily/weekly/monthly trends
    // - Focus session patterns
    // - Meeting impact analysis
    // - Productivity score trends
    // - Recommendations for improvement
    return {}
  }

  async trackFocusSession(userId: string, sessionData: {
    startTime: Date
    endTime: Date
    duration: number
    completed: boolean
    interruptions: number
  }): Promise<void> {
    // TODO: Implement focus session tracking
    // - Store session data
    // - Update productivity metrics
    // - Generate insights
  }

  async trackMeeting(userId: string, meetingData: {
    startTime: Date
    endTime: Date
    duration: number
    type: string
    participants: string[]
    agenda: string
    outcomes: string[]
  }): Promise<void> {
    // TODO: Implement meeting tracking
    // - Store meeting data
    // - Update productivity metrics
    // - Generate insights
  }
} 