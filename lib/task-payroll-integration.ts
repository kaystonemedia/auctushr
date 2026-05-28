import { db } from '@/lib/firebase-admin'
import { ProductivityScore, TaskRecord } from '@/types/task'
import { productivityScoringService } from '@/lib/productivity-scoring'

export interface IntegratedProductivityScore {
  userId: string
  date: Date
  monitoringScore: number // From Electron app
  taskScore: number // From task completion
  blendedScore: number // Combined score
  payrollImpact: {
    productivityBonus: number
    taskBonus: number
    totalBonus: number
  }
  breakdown: {
    taskCompletion: number
    onTimeCompletion: number
    priorityBonus: number
    difficultyBonus: number
    productivityImpact: number
    streakBonus: number
    penalties: number
  }
}

export class TaskPayrollIntegrationService {
  private static instance: TaskPayrollIntegrationService

  static getInstance(): TaskPayrollIntegrationService {
    if (!TaskPayrollIntegrationService.instance) {
      TaskPayrollIntegrationService.instance = new TaskPayrollIntegrationService()
    }
    return TaskPayrollIntegrationService.instance
  }

  /**
   * Calculate integrated productivity score combining monitoring and task data
   */
  async calculateIntegratedProductivityScore(
    userId: string,
    date: Date,
    monitoringScore: number
  ): Promise<IntegratedProductivityScore> {
    try {
      // Get task records for the date
      const startOfDay = new Date(date)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(date)
      endOfDay.setHours(23, 59, 59, 999)

      const taskRecordsSnapshot = await db.collection('taskRecords')
        .where('userId', '==', userId)
        .where('timestamp', '>=', startOfDay)
        .where('timestamp', '<=', endOfDay)
        .get()

      const taskRecords = taskRecordsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate()
      })) as TaskRecord[]

      // Calculate task-based productivity score
      const taskScore = this.calculateTaskBasedScore(taskRecords)
      
      // Blend with monitoring score (60% task, 40% monitoring)
      const blendedScore = Math.round(taskScore * 0.6 + monitoringScore * 0.4)

      // Calculate payroll impact
      const payrollImpact = await this.calculatePayrollImpact(blendedScore, taskRecords)

      // Generate detailed breakdown
      const breakdown = this.generateScoreBreakdown(taskRecords)

      return {
        userId,
        date,
        monitoringScore,
        taskScore,
        blendedScore,
        payrollImpact,
        breakdown
      }
    } catch (error) {
      console.error('Error calculating integrated productivity score:', error)
      throw error
    }
  }

  /**
   * Update daily productivity score with integrated data
   */
  async updateDailyProductivityScore(
    userId: string,
    date: Date,
    monitoringScore: number
  ): Promise<void> {
    try {
      const integratedScore = await this.calculateIntegratedProductivityScore(
        userId,
        date,
        monitoringScore
      )

      // Save to productivityScores collection
      const scoreId = `${userId}_${date.toISOString().split('T')[0]}`
      const productivityScore: ProductivityScore = {
        id: scoreId,
        userId,
        date,
        taskScore: integratedScore.taskScore,
        monitoringScore: integratedScore.monitoringScore,
        blendedScore: integratedScore.blendedScore,
        taskCount: integratedScore.breakdown.taskCompletion,
        completedTasks: this.getCompletedTasksCount(integratedScore.breakdown),
        onTimeTasks: this.getOnTimeTasksCount(integratedScore.breakdown),
        overdueTasks: this.getOverdueTasksCount(integratedScore.breakdown),
        averageCompletionTime: 0, // Would be calculated from actual task data
        focusTime: 0, // From monitoring data
        breakTime: 0, // From monitoring data
        streak: await this.calculateStreak(userId, date),
        badges: await this.calculateBadges(userId, date),
        level: await this.calculateLevel(userId),
        experience: this.calculateExperience(integratedScore.blendedScore)
      }

      await db.collection('productivityScores').doc(scoreId).set(productivityScore)

      // Update payroll calculation triggers
      await this.triggerPayrollUpdate(userId, date, integratedScore.payrollImpact)
    } catch (error) {
      console.error('Error updating daily productivity score:', error)
      throw error
    }
  }

  /**
   * Calculate task-based productivity score
   */
  private calculateTaskBasedScore(taskRecords: TaskRecord[]): number {
    let score = 0

    for (const record of taskRecords) {
      switch (record.action) {
        case 'completed':
          score += 15 // Base completion score
          if (record.productivityScore && record.productivityScore > 0) {
            score += record.productivityScore
          }
          break
        case 'accepted':
          score += 5 // Acceptance bonus
          break
        case 'started':
          score += 3 // Starting bonus
          break
        case 'cancelled':
          score -= 10 // Cancellation penalty
          break
        case 'blocked':
          score -= 5 // Blocked penalty
          break
      }
    }

    return Math.max(0, Math.min(100, score))
  }

  /**
   * Calculate payroll impact based on productivity score
   */
  private async calculatePayrollImpact(
    blendedScore: number,
    taskRecords: TaskRecord[]
  ): Promise<IntegratedProductivityScore['payrollImpact']> {
    // Get payroll settings
    const settingsSnapshot = await db.collection('settings').doc('payroll').get()
    const payrollSettings = settingsSnapshot.exists ? settingsSnapshot.data() : null

    if (!payrollSettings) {
      return {
        productivityBonus: 0,
        taskBonus: 0,
        totalBonus: 0
      }
    }

    // Calculate productivity bonus (from existing system)
    const productivityBonus = this.calculateProductivityBonus(
      blendedScore,
      payrollSettings.bonusStructure?.productivity
    )

    // Calculate task-specific bonus
    const taskBonus = this.calculateTaskBonus(taskRecords, payrollSettings.bonusStructure?.tasks)

    return {
      productivityBonus,
      taskBonus,
      totalBonus: productivityBonus + taskBonus
    }
  }

  /**
   * Calculate productivity bonus based on settings
   */
  private calculateProductivityBonus(score: number, productivitySettings: any): number {
    if (!productivitySettings?.enabled || !productivitySettings.tiers) {
      return 0
    }

    for (const tier of productivitySettings.tiers) {
      if (score >= tier.minScore && score <= tier.maxScore) {
        return tier.bonusAmount || 0
      }
    }

    return 0
  }

  /**
   * Calculate task-specific bonus
   */
  private calculateTaskBonus(taskRecords: TaskRecord[], taskSettings: any): number {
    if (!taskSettings?.enabled) {
      return 0
    }

    const completedTasks = taskRecords.filter(r => r.action === 'completed').length
    const onTimeTasks = taskRecords.filter(r => 
      r.action === 'completed' && r.productivityScore && r.productivityScore > 0
    ).length

    let bonus = 0

    // Completion bonus
    if (completedTasks >= taskSettings.completionThreshold) {
      bonus += taskSettings.completionBonus || 0
    }

    // On-time bonus
    const onTimeRate = completedTasks > 0 ? (onTimeTasks / completedTasks) * 100 : 0
    if (onTimeRate >= taskSettings.onTimeThreshold) {
      bonus += taskSettings.onTimeBonus || 0
    }

    return bonus
  }

  /**
   * Generate detailed score breakdown
   */
  private generateScoreBreakdown(taskRecords: TaskRecord[]): IntegratedProductivityScore['breakdown'] {
    const completedTasks = taskRecords.filter(r => r.action === 'completed').length
    const onTimeTasks = taskRecords.filter(r => 
      r.action === 'completed' && r.productivityScore && r.productivityScore > 0
    ).length
    const cancelledTasks = taskRecords.filter(r => r.action === 'cancelled').length

    return {
      taskCompletion: completedTasks * 15,
      onTimeCompletion: onTimeTasks * 10,
      priorityBonus: 0, // Would be calculated from task priority
      difficultyBonus: 0, // Would be calculated from task difficulty
      productivityImpact: 0, // Would be calculated from task impact
      streakBonus: 0, // Would be calculated from streak
      penalties: cancelledTasks * 10
    }
  }

  /**
   * Trigger payroll update for the user
   */
  private async triggerPayrollUpdate(
    userId: string,
    date: Date,
    payrollImpact: IntegratedProductivityScore['payrollImpact']
  ): Promise<void> {
    try {
      // Create payroll update record
      await db.collection('payrollUpdates').add({
        userId,
        date,
        type: 'productivity_update',
        data: payrollImpact,
        processed: false,
        createdAt: new Date()
      })

      // Send notification to payroll system
      await db.collection('notifications').add({
        userId: 'payroll_system',
        type: 'payroll_update',
        title: 'Productivity Score Updated',
        message: `Productivity score updated for user ${userId}`,
        data: { userId, date, payrollImpact },
        read: false,
        createdAt: new Date()
      })
    } catch (error) {
      console.error('Error triggering payroll update:', error)
    }
  }

  // Helper methods
  private getCompletedTasksCount(breakdown: any): number {
    return Math.floor(breakdown.taskCompletion / 15) // Assuming 15 points per completed task
  }

  private getOnTimeTasksCount(breakdown: any): number {
    return Math.floor(breakdown.onTimeCompletion / 10) // Assuming 10 points per on-time task
  }

  private getOverdueTasksCount(breakdown: any): number {
    return Math.floor(breakdown.penalties / 10) // Assuming 10 points penalty per overdue task
  }

  private async calculateStreak(userId: string, date: Date): Promise<number> {
    // Implementation would calculate streak from productivity scores
    return 5 // Mock value
  }

  private async calculateBadges(userId: string, date: Date): Promise<string[]> {
    // Implementation would calculate badges based on achievements
    return ['task_starter'] // Mock value
  }

  private async calculateLevel(userId: string): Promise<number> {
    // Implementation would calculate level based on total experience
    return 2 // Mock value
  }

  private calculateExperience(blendedScore: number): number {
    return Math.floor(blendedScore * 1.5)
  }
}

// Export singleton instance
export const taskPayrollIntegrationService = TaskPayrollIntegrationService.getInstance()







