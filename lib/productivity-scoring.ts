import { 
  Task, 
  TaskRecord, 
  ProductivityScore, 
  ProductivityEvent, 
  ProductivityDaily,
  TaskPriority, 
  TaskStatus,
  ScoringWeights,
  TimeEntry
} from '@/types/task'

// Default scoring weights as per roadmap
export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  priorityWeights: {
    low: 0.8,
    medium: 1.0,
    high: 1.2,
    urgent: 1.5
  },
  actionScores: {
    accept: 1,
    startWithin24h: 2,
    completeBase: 1,
    onTimeBonus: 0.2, // 20% of base
    earlyBonus: 0.3, // 30% of base
    overduePenalty: -0.3, // -30% per day
    reopenPenalty: -0.25, // -25% of base
    blockedPenalty: -2, // -2 per day
    timeDriftPenalty: -0.2 // -20% of base
  },
  blendingWeights: {
    monitoring: 0.6,
    task: 0.4
  },
  difficultyMultipliers: {
    easy: 0.8,
    medium: 1.0,
    hard: 1.3
  },
  productivityImpactMultipliers: {
    positive: 1.2,
    neutral: 1.0,
    negative: 0.8
  }
}

export class ProductivityScoringService {
  private weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS

  /**
   * Calculate task completion score based on various factors
   */
  calculateTaskScore(task: Task, record: TaskRecord): number {
    let score = 0

    // Base completion score
    if (record.action === 'completed') {
      score += this.weights.taskCompletion

      // Priority bonus
      const priorityMultiplier = this.getPriorityMultiplier(task.priority)
      score += this.weights.priorityBonus * priorityMultiplier

      // Difficulty bonus
      const difficultyMultiplier = this.getDifficultyMultiplier(task.difficulty)
      score += this.weights.difficultyBonus * difficultyMultiplier

      // Productivity impact bonus/penalty
      const impactMultiplier = this.getProductivityImpactMultiplier(task.productivityImpact)
      score += this.weights.productivityImpact * impactMultiplier

      // On-time completion bonus
      if (this.isOnTimeCompletion(task)) {
        score += this.weights.onTimeCompletion
      } else {
        score += this.weights.overduePenalty
      }
    }

    // Penalty for cancellation
    if (record.action === 'cancelled') {
      score += this.weights.cancellationPenalty
    }

    return Math.max(0, score) // Ensure non-negative score
  }

  /**
   * Calculate daily productivity score by blending task scores with monitoring scores
   */
  calculateDailyScore(
    taskRecords: TaskRecord[],
    monitoringScore: number,
    userId: string,
    date: Date
  ): ProductivityScore {
    const taskScore = this.calculateTaskScoreFromRecords(taskRecords)
    const blendedScore = this.blendScores(taskScore, monitoringScore)

    const stats = this.calculateTaskStats(taskRecords)
    const streak = this.calculateStreak(userId, date)
    const badges = this.calculateBadges(stats, streak)
    const level = this.calculateLevel(blendedScore, streak)

    return {
      id: `${userId}_${date.toISOString().split('T')[0]}`,
      userId,
      date,
      taskScore,
      monitoringScore,
      blendedScore,
      taskCount: stats.total,
      completedTasks: stats.completed,
      onTimeTasks: stats.onTime,
      overdueTasks: stats.overdue,
      averageCompletionTime: stats.averageCompletionTime,
      focusTime: 0, // Will be populated from monitoring data
      breakTime: 0, // Will be populated from monitoring data
      streak,
      badges,
      level,
      experience: this.calculateExperience(blendedScore, streak)
    }
  }

  /**
   * Apply task event delta and return score change with reasons
   */
  async applyTaskEventDelta(
    userId: string, 
    task: Task, 
    eventType: ProductivityEvent['action'], 
    context?: any
  ): Promise<{ scoreChange: number; reasons: string[] }> {
    const reasons: string[] = []
    let scoreChange = 0

    switch (eventType) {
      case 'accepted':
        scoreChange += this.weights.actionScores.accept
        reasons.push('Task accepted')
        break

      case 'started':
        // Check if started within 24h of assignment
        if (task.assignedAt && this.isWithin24Hours(task.assignedAt, new Date())) {
          scoreChange += this.weights.actionScores.startWithin24h
          reasons.push('Started within 24h of assignment')
        }
        break

      case 'completed':
        const baseScore = Math.ceil(task.estimatedHours || 1) * this.getPriorityMultiplier(task.priority)
        scoreChange += baseScore * this.weights.actionScores.completeBase
        reasons.push(`Base completion score: ${baseScore}`)

        // On-time bonus
        if (this.isOnTimeCompletion(task)) {
          const bonus = baseScore * this.weights.actionScores.onTimeBonus
          scoreChange += bonus
          reasons.push(`On-time bonus: +${bonus}`)
        }

        // Early bonus
        if (this.isEarlyCompletion(task)) {
          const bonus = baseScore * this.weights.actionScores.earlyBonus
          scoreChange += bonus
          reasons.push(`Early completion bonus: +${bonus}`)
        }

        // Overdue penalty
        if (this.isOverdue(task)) {
          const daysOverdue = this.getDaysOverdue(task)
          const penalty = baseScore * this.weights.actionScores.overduePenalty * daysOverdue
          scoreChange += penalty
          reasons.push(`Overdue penalty: ${penalty} (${daysOverdue} days)`)
        }

        // Time drift penalty
        if (this.hasTimeDrift(task)) {
          const penalty = baseScore * this.weights.actionScores.timeDriftPenalty
          scoreChange += penalty
          reasons.push(`Time drift penalty: ${penalty}`)
        }
        break

      case 'reopened':
        const reopenPenalty = baseScore * this.weights.actionScores.reopenPenalty
        scoreChange += reopenPenalty
        reasons.push(`Reopened penalty: ${reopenPenalty}`)
        break

      case 'blocked':
        // Blocked penalty (per day)
        const blockedPenalty = this.weights.actionScores.blockedPenalty
        scoreChange += blockedPenalty
        reasons.push(`Blocked penalty: ${blockedPenalty}`)
        break

      case 'overdue_tick':
        const overduePenalty = baseScore * this.weights.actionScores.overduePenalty
        scoreChange += overduePenalty
        reasons.push(`Overdue tick penalty: ${overduePenalty}`)
        break
    }

    // Apply difficulty multiplier
    if (task.difficulty) {
      const multiplier = this.weights.difficultyMultipliers[task.difficulty]
      scoreChange *= multiplier
      reasons.push(`Difficulty multiplier (${task.difficulty}): ${multiplier}x`)
    }

    // Apply productivity impact multiplier
    if (task.productivityImpact) {
      const multiplier = this.weights.productivityImpactMultipliers[task.productivityImpact]
      scoreChange *= multiplier
      reasons.push(`Productivity impact multiplier (${task.productivityImpact}): ${multiplier}x`)
    }

    return { scoreChange: Math.round(scoreChange), reasons }
  }

  /**
   * Process scoring event and update productivity logs
   */
  async processScoringEvent(event: ProductivityEvent): Promise<void> {
    // Create productivity event
    const productivityEvent: ProductivityEvent = {
      id: `${event.taskId}_${event.userId}_${event.timestamp.getTime()}`,
      userId: event.userId,
      taskId: event.taskId,
      action: event.action,
      timestamp: event.timestamp,
      scoreChange: event.scoreChange,
      meta: event.meta,
      reasons: event.reasons
    }

    // Save to Firestore
    await this.saveProductivityEvent(productivityEvent)
    
    // Update daily productivity score
    await this.updateDailyProductivityScore(event.userId, event.timestamp)
  }

  /**
   * Calculate streak based on consecutive days of task completion
   */
  private calculateStreak(userId: string, currentDate: Date): number {
    // This would query Firestore for consecutive days of task completion
    // For now, return a mock value
    return 5
  }

  /**
   * Calculate badges based on achievements
   */
  private calculateBadges(stats: any, streak: number): string[] {
    const badges: string[] = []

    if (stats.completed >= 10) badges.push('task_master')
    if (stats.onTime >= 5) badges.push('punctual')
    if (streak >= 7) badges.push('consistent')
    if (stats.completed >= 50) badges.push('productive')
    if (stats.averageCompletionTime <= 2) badges.push('efficient')

    return badges
  }

  /**
   * Calculate user level based on productivity score and streak
   */
  private calculateLevel(blendedScore: number, streak: number): number {
    const baseLevel = Math.floor(blendedScore / 100)
    const streakBonus = Math.floor(streak / 7)
    return Math.max(1, baseLevel + streakBonus)
  }

  /**
   * Calculate experience points
   */
  private calculateExperience(blendedScore: number, streak: number): number {
    return Math.floor(blendedScore * 1.5 + streak * 10)
  }

  /**
   * Get priority multiplier for scoring
   */
  private getPriorityMultiplier(priority: TaskPriority): number {
    const multipliers = {
      low: 0.5,
      medium: 1.0,
      high: 1.5,
      urgent: 2.0
    }
    return multipliers[priority]
  }

  /**
   * Get difficulty multiplier for scoring
   */
  private getDifficultyMultiplier(difficulty?: string): number {
    const multipliers = {
      easy: 0.8,
      medium: 1.0,
      hard: 1.3
    }
    return multipliers[difficulty as keyof typeof multipliers] || 1.0
  }

  /**
   * Get productivity impact multiplier
   */
  private getProductivityImpactMultiplier(impact?: string): number {
    const multipliers = {
      positive: 1.2,
      neutral: 1.0,
      negative: 0.8
    }
    return multipliers[impact as keyof typeof multipliers] || 1.0
  }

  /**
   * Check if task was completed on time
   */
  private isOnTimeCompletion(task: Task): boolean {
    if (!task.completedAt) return false
    return task.completedAt <= task.dueDate
  }

  /**
   * Check if task was completed early
   */
  private isEarlyCompletion(task: Task): boolean {
    if (!task.completedAt) return false
    const hoursEarly = (task.dueDate.getTime() - task.completedAt.getTime()) / (1000 * 60 * 60)
    return hoursEarly > 24 // More than 24 hours early
  }

  /**
   * Check if task is overdue
   */
  private isOverdue(task: Task): boolean {
    if (!task.completedAt) return false
    return task.completedAt > task.dueDate
  }

  /**
   * Get days overdue
   */
  private getDaysOverdue(task: Task): number {
    if (!task.completedAt) return 0
    const daysOverdue = Math.ceil((task.completedAt.getTime() - task.dueDate.getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(0, daysOverdue)
  }

  /**
   * Check if task has time drift (actual > 1.5x estimated)
   */
  private hasTimeDrift(task: Task): boolean {
    if (!task.estimatedHours || !task.actualHours) return false
    return task.actualHours > (task.estimatedHours * 1.5)
  }

  /**
   * Check if time is within 24 hours
   */
  private isWithin24Hours(start: Date, end: Date): boolean {
    const hoursDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
    return hoursDiff <= 24
  }

  /**
   * Calculate task score from records
   */
  private calculateTaskScoreFromRecords(records: TaskRecord[]): number {
    return records.reduce((total, record) => {
      return total + (record.productivityScore || 0)
    }, 0)
  }

  /**
   * Blend task score with monitoring score
   */
  private blendScores(taskScore: number, monitoringScore: number): number {
    // Weighted average: 60% monitoring score, 40% task score (as per roadmap)
    const monitoringWeight = this.weights.blendingWeights.monitoring
    const taskWeight = this.weights.blendingWeights.task
    
    return Math.round(taskScore * taskWeight + monitoringScore * monitoringWeight)
  }

  /**
   * Calculate task statistics from records
   */
  private calculateTaskStats(records: TaskRecord[]): any {
    const completed = records.filter(r => r.action === 'completed').length
    const total = records.length
    const onTime = records.filter(r => r.action === 'completed' && r.productivityScore && r.productivityScore > 0).length
    const overdue = records.filter(r => r.action === 'completed' && r.productivityScore && r.productivityScore < 0).length

    return {
      total,
      completed,
      onTime,
      overdue,
      averageCompletionTime: 2.5 // Mock value
    }
  }

  /**
   * Map event type to task record action
   */
  private mapEventToAction(eventType: string): TaskRecord['action'] {
    const mapping: Record<string, TaskRecord['action']> = {
      'task_assigned': 'assigned',
      'task_accepted': 'accepted',
      'task_started': 'started',
      'task_completed': 'completed',
      'task_overdue': 'completed', // Overdue tasks are still completed
      'task_cancelled': 'cancelled'
    }
    return mapping[eventType] || 'assigned'
  }

  /**
   * Calculate score for a specific event
   */
  private async calculateEventScore(event: ScoringEvent): Promise<number> {
    // This would fetch the task and calculate the score
    // For now, return a mock value
    return 10
  }

  /**
   * Save productivity event to Firestore
   */
  private async saveProductivityEvent(event: ProductivityEvent): Promise<void> {
    try {
      const { db } = await import('@/lib/firebase-admin')
      await db.collection('productivityLogs').doc(event.userId).collection('events').add(event)
    } catch (error) {
      console.error('Error saving productivity event:', error)
    }
  }

  /**
   * Update daily productivity score
   */
  private async updateDailyProductivityScore(userId: string, date: Date): Promise<void> {
    try {
      const { taskPayrollIntegrationService } = await import('@/lib/task-payroll-integration')
      
      // Get monitoring score from existing productivity system
      const { db } = await import('@/lib/firebase-admin')
      const monitoringSnapshot = await db.collection('productivityLogs')
        .where('userId', '==', userId)
        .where('date', '==', date.toISOString().split('T')[0])
        .limit(1)
        .get()

      const monitoringScore = monitoringSnapshot.empty ? 0 : 
        monitoringSnapshot.docs[0].data().productivityScore || 0

      // Update integrated productivity score
      await taskPayrollIntegrationService.updateDailyProductivityScore(
        userId,
        date,
        monitoringScore
      )
    } catch (error) {
      console.error('Error updating daily productivity score:', error)
    }
  }
}

// Export singleton instance
export const productivityScoringService = new ProductivityScoringService()
