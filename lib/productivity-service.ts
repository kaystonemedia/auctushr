import { db } from './firebase'
import { collection, doc, addDoc, updateDoc, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore'
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

  private constructor(settings: ProductivitySettings) {
    this.settings = settings
  }

  public static getInstance(settings: ProductivitySettings): ProductivityService {
    if (!ProductivityService.instance) {
      ProductivityService.instance = new ProductivityService(settings)
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
      userId: employeeId,
      startTime: new Date(),
      endTime: new Date(), // Will be updated when session ends
      duration: 0, // Will be calculated when session ends
      completed: false,
      interruptions: 0,
      notes: `Task: ${taskId}`
    }

    const docRef = await addDoc(collection(db, 'focusSessions'), {
      ...session,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    })

    return {
      id: docRef.id,
      ...session,
      createdAt: session.startTime,
      updatedAt: session.startTime
    }
  }

  async endFocusSession(sessionId: string, notes?: string): Promise<void> {
    const sessionRef = doc(db, 'focusSessions', sessionId)
    const sessionDoc = await getDocs(query(collection(db, 'focusSessions'), where('id', '==', sessionId)))
    const session = sessionDoc.docs[0].data() as FocusSession

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
    const taskDoc = await getDocs(query(collection(db, 'tasks'), where('id', '==', taskId)))
    const task = taskDoc.docs[0].data() as TaskRecord

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

  public async getTasks(employeeId: string, startDate: Date, endDate: Date): Promise<TaskRecord[]> {
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
      startTime: doc.data().startTime?.toDate() || new Date(),
      endTime: doc.data().endTime?.toDate(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date()
    })) as TaskRecord[]
  }

  private async getFocusSessions(employeeId: string, startDate: Date, endDate: Date): Promise<FocusSession[]> {
    const q = query(
      collection(db, 'focusSessions'),
      where('employeeId', '==', employeeId),
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
      interruptions: doc.data().interruptions.map((i: any) => ({
        ...i,
        time: i.time.toDate()
      }))
    })) as FocusSession[]
  }

  private async getMeetings(employeeId: string, startDate: Date, endDate: Date): Promise<MeetingRecord[]> {
    const q = query(
      collection(db, 'meetings'),
      where('participants', 'array-contains', { id: employeeId }),
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
    const projectIds = [...new Set(tasks.map(t => t.projectId).filter(Boolean))]
    const metrics: ProductivityAnalytics['projectWise'] = []

    for (const projectId of projectIds) {
      const projectTasks = tasks.filter(t => t.projectId === projectId)
      const projectDoc = await getDocs(query(collection(db, 'projects'), where('id', '==', projectId)))
      const project = projectDoc.docs[0].data() as Project

      metrics.push({
        projectId,
        projectName: project.name,
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
    // Get employee's department
    const employeeDoc = await getDocs(query(collection(db, 'users'), where('id', '==', employeeId)))
    const employee = employeeDoc.docs[0].data()
    const department = employee.department

    // Get all employees in the same department
    const teamDocs = await getDocs(query(collection(db, 'users'), where('department', '==', department)))
    const teamStats: ProductivityAnalytics['teamStats'] = []

    for (const doc of teamDocs.docs) {
      const teamMember = doc.data()
      const [tasks, sessions, meetings] = await Promise.all([
        this.getTasks(teamMember.id, startDate, endDate),
        this.getFocusSessions(teamMember.id, startDate, endDate),
        this.getMeetings(teamMember.id, startDate, endDate)
      ])

      teamStats.push({
        employeeId: teamMember.id,
        name: teamMember.name,
        productivityScore: this.calculateAverageProductivityScore(sessions),
        focusTime: sessions.reduce((total, s) => total + s.duration, 0),
        meetingTime: meetings.reduce((total, m) => total + m.duration, 0),
        tasksCompleted: tasks.filter(t => t.status === 'completed').length
      })
    }

    return teamStats
  }
} 