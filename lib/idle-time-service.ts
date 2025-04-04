import { db } from './firebase'
import { collection, doc, updateDoc, arrayUnion, Timestamp, addDoc } from 'firebase/firestore'
import { AttendanceRecord, AttendanceSettings } from '@/types/attendance'

export class IdleTimeService {
  private static instance: IdleTimeService
  private idleTimeout: NodeJS.Timeout | null = null
  private lastActivity: Date = new Date()
  private isIdle: boolean = false
  private currentRecord: AttendanceRecord | null = null
  private settings: AttendanceSettings

  private constructor(settings: AttendanceSettings) {
    this.settings = settings
    this.setupActivityListeners()
  }

  public static getInstance(settings: AttendanceSettings): IdleTimeService {
    if (!IdleTimeService.instance) {
      IdleTimeService.instance = new IdleTimeService(settings)
    }
    return IdleTimeService.instance
  }

  private setupActivityListeners(): void {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart']
    events.forEach(event => {
      document.addEventListener(event, () => this.handleActivity())
    })
  }

  private handleActivity(): void {
    this.lastActivity = new Date()
    if (this.isIdle) {
      this.handleIdleEnd()
    }
    this.resetIdleTimeout()
  }

  private resetIdleTimeout(): void {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout)
    }
    this.idleTimeout = setTimeout(() => this.handleIdleStart(), this.settings.idleThreshold * 60 * 1000)
  }

  private async handleIdleStart(): Promise<void> {
    if (!this.currentRecord) return

    this.isIdle = true
    const idleStart = new Date()

    // Update attendance record with idle period
    const attendanceRef = doc(db, 'attendance', this.currentRecord.id)
    await updateDoc(attendanceRef, {
      idleTime: arrayUnion({
        startTime: Timestamp.fromDate(idleStart),
        endTime: null,
        duration: 0
      })
    })

    // Send notification to manager if configured
    if (this.settings.requireManagerApproval) {
      await this.sendIdleNotification(this.currentRecord, idleStart)
    }
  }

  private async handleIdleEnd(): Promise<void> {
    if (!this.currentRecord) return

    this.isIdle = false
    const idleEnd = new Date()

    // Find the last idle period and update it
    const attendanceRef = doc(db, 'attendance', this.currentRecord.id)
    const idlePeriods = this.currentRecord.idleTime || []
    const lastIdlePeriod = idlePeriods[idlePeriods.length - 1]

    if (lastIdlePeriod && !lastIdlePeriod.endTime) {
      const duration = (idleEnd.getTime() - lastIdlePeriod.startTime.getTime()) / (1000 * 60) // in minutes
      await updateDoc(attendanceRef, {
        idleTime: idlePeriods.map((period, index) => 
          index === idlePeriods.length - 1
            ? { ...period, endTime: Timestamp.fromDate(idleEnd), duration }
            : period
        )
      })
    }

    this.resetIdleTimeout()
  }

  private async sendIdleNotification(record: AttendanceRecord, idleStart: Date): Promise<void> {
    const notificationRef = collection(db, 'notifications')
    await addDoc(notificationRef, {
      type: 'idle_time',
      employeeId: record.employeeId,
      employeeName: record.employeeName,
      managerId: record.managerId,
      message: `${record.employeeName} has been idle since ${idleStart.toLocaleTimeString()}`,
      timestamp: Timestamp.now(),
      status: 'unread',
      attendanceId: record.id
    })
  }

  public startTracking(record: AttendanceRecord): void {
    this.currentRecord = record
    this.resetIdleTimeout()
  }

  public stopTracking(): void {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout)
      this.idleTimeout = null
    }
    this.currentRecord = null
    this.isIdle = false
  }
} 