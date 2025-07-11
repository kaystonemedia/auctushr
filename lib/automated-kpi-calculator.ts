import { performanceService } from './performance-service'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from './firebase'

export class AutomatedKPICalculator {
  
  // ========== PRODUCTIVITY-BASED KPIs ==========
  
  async calculateProductivityKPIs(employeeId: string, reviewId: string) {
    try {
      // Get productivity data from the existing chrome extension tracking
      const productivityData = await this.getProductivityData(employeeId)
      
      // Calculate Focus Time KPI
      const focusTimeKPI = await this.calculateFocusTimeScore(employeeId, productivityData)
      
      // Calculate Task Completion KPI  
      const taskCompletionKPI = await this.calculateTaskCompletionScore(employeeId)
      
      // Calculate Attendance KPI
      const attendanceKPI = await this.calculateAttendanceScore(employeeId)
      
      // Calculate Website Productivity KPI
      const websiteProductivityKPI = await this.calculateWebsiteProductivityScore(employeeId, productivityData)
      
      // Create KPI scores automatically
      const kpiScores = [
        focusTimeKPI,
        taskCompletionKPI,
        attendanceKPI,
        websiteProductivityKPI
      ]
      
      // Save to performance review
      for (const kpiScore of kpiScores) {
        await performanceService.calculateKPIScore(
          employeeId,
          kpiScore.kpiId,
          kpiScore.actualValue,
          reviewId
        )
      }
      
      return kpiScores
    } catch (error) {
      console.error('Error calculating automated KPIs:', error)
      throw error
    }
  }
  
  // ========== INDIVIDUAL KPI CALCULATIONS ==========
  
  async calculateFocusTimeScore(employeeId: string, productivityData: any) {
    // Target: 6 hours of focus time per day
    const target = 6 * 60 // 6 hours in minutes
    const actualFocusTime = productivityData.dailyFocusTime || 0
    
    return {
      kpiId: 'focus-time',
      name: 'Daily Focus Time',
      actualValue: actualFocusTime / 60, // Convert to hours
      targetValue: 6,
      score: this.calculateScore(actualFocusTime, target),
      unit: 'hours'
    }
  }
  
  async calculateTaskCompletionScore(employeeId: string) {
    // Get task completion rate from task management system
    const tasksQuery = query(
      collection(db, 'tasks'),
      where('assignedTo', '==', employeeId)
    )
    
    const tasksSnapshot = await getDocs(tasksQuery)
    const tasks = tasksSnapshot.docs.map(doc => doc.data())
    
    const totalTasks = tasks.length
    const completedTasks = tasks.filter(task => task.status === 'completed').length
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
    
    return {
      kpiId: 'task-completion',
      name: 'Task Completion Rate',
      actualValue: completionRate,
      targetValue: 90,
      score: this.calculateScore(completionRate, 90),
      unit: 'percentage'
    }
  }
  
  async calculateAttendanceScore(employeeId: string) {
    // Get attendance data from attendance system
    const attendanceQuery = query(
      collection(db, 'attendance'),
      where('employeeId', '==', employeeId)
    )
    
    const attendanceSnapshot = await getDocs(attendanceQuery)
    const attendanceRecords = attendanceSnapshot.docs.map(doc => doc.data())
    
    const totalDays = attendanceRecords.length
    const presentDays = attendanceRecords.filter(record => record.status === 'present').length
    const attendanceRate = totalDays > 0 ? (presentDays / totalDays) * 100 : 0
    
    return {
      kpiId: 'attendance-rate',
      name: 'Attendance Rate',
      actualValue: attendanceRate,
      targetValue: 95,
      score: this.calculateScore(attendanceRate, 95),
      unit: 'percentage'
    }
  }
  
  async calculateWebsiteProductivityScore(employeeId: string, productivityData: any) {
    // Calculate productive website usage vs distracting sites
    const productiveTime = productivityData.productiveWebsiteTime || 0
    const distractingTime = productivityData.distractingWebsiteTime || 0
    const totalTime = productiveTime + distractingTime
    
    const productivityRatio = totalTime > 0 ? (productiveTime / totalTime) * 100 : 0
    
    return {
      kpiId: 'website-productivity',
      name: 'Website Productivity Score',
      actualValue: productivityRatio,
      targetValue: 80,
      score: this.calculateScore(productivityRatio, 80),
      unit: 'percentage'
    }
  }
  
  // ========== TEAM-BASED KPIs ==========
  
  async calculateTeamLeadershipKPIs(managerId: string, reviewId: string) {
    try {
      // Get team members
      const teamQuery = query(
        collection(db, 'employees'),
        where('managerId', '==', managerId)
      )
      
      const teamSnapshot = await getDocs(teamQuery)
      const teamMembers = teamSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      
      // Calculate team performance average
      const teamPerformanceKPI = await this.calculateTeamPerformanceScore(teamMembers)
      
      // Calculate team retention rate
      const teamRetentionKPI = await this.calculateTeamRetentionScore(teamMembers)
      
      // Calculate 1:1 meeting consistency
      const oneOnOneKPI = await this.calculateOneOnOneScore(managerId, teamMembers)
      
      const kpiScores = [
        teamPerformanceKPI,
        teamRetentionKPI,
        oneOnOneKPI
      ]
      
      // Save to performance review
      for (const kpiScore of kpiScores) {
        await performanceService.calculateKPIScore(
          managerId,
          kpiScore.kpiId,
          kpiScore.actualValue,
          reviewId
        )
      }
      
      return kpiScores
    } catch (error) {
      console.error('Error calculating team leadership KPIs:', error)
      throw error
    }
  }
  
  async calculateTeamPerformanceScore(teamMembers: any[]) {
    // Calculate average performance rating of team members
    const teamPerformanceRatings = teamMembers.map(member => member.lastPerformanceRating || 3)
    const averageRating = teamPerformanceRatings.reduce((sum, rating) => sum + rating, 0) / teamPerformanceRatings.length
    
    return {
      kpiId: 'team-performance',
      name: 'Team Performance Average',
      actualValue: averageRating,
      targetValue: 4.0,
      score: this.calculateScore(averageRating, 4.0),
      unit: 'rating'
    }
  }
  
  async calculateTeamRetentionScore(teamMembers: any[]) {
    // Calculate team retention rate (simplified - in real implementation would check termination dates)
    const activeMembers = teamMembers.filter(member => member.status === 'active').length
    const totalMembers = teamMembers.length
    const retentionRate = totalMembers > 0 ? (activeMembers / totalMembers) * 100 : 0
    
    return {
      kpiId: 'team-retention',
      name: 'Team Retention Rate',
      actualValue: retentionRate,
      targetValue: 95,
      score: this.calculateScore(retentionRate, 95),
      unit: 'percentage'
    }
  }
  
  async calculateOneOnOneScore(managerId: string, teamMembers: any[]) {
    // Calculate 1:1 meeting consistency (mock implementation)
    // In real implementation, would check calendar/meeting data
    const targetMeetings = teamMembers.length * 4 // 4 meetings per member per month
    const actualMeetings = Math.floor(targetMeetings * 0.85) // Assuming 85% completion
    const meetingConsistency = (actualMeetings / targetMeetings) * 100
    
    return {
      kpiId: 'one-on-one-consistency',
      name: '1:1 Meeting Consistency',
      actualValue: meetingConsistency,
      targetValue: 100,
      score: this.calculateScore(meetingConsistency, 100),
      unit: 'percentage'
    }
  }
  
  // ========== SALES KPIs ==========
  
  async calculateSalesKPIs(employeeId: string, reviewId: string) {
    try {
      // Revenue achievement
      const revenueKPI = await this.calculateRevenueAchievement(employeeId)
      
      // Lead conversion rate
      const conversionKPI = await this.calculateLeadConversionRate(employeeId)
      
      // Customer satisfaction
      const satisfactionKPI = await this.calculateCustomerSatisfaction(employeeId)
      
      const kpiScores = [
        revenueKPI,
        conversionKPI,
        satisfactionKPI
      ]
      
      // Save to performance review
      for (const kpiScore of kpiScores) {
        await performanceService.calculateKPIScore(
          employeeId,
          kpiScore.kpiId,
          kpiScore.actualValue,
          reviewId
        )
      }
      
      return kpiScores
    } catch (error) {
      console.error('Error calculating sales KPIs:', error)
      throw error
    }
  }
  
  async calculateRevenueAchievement(employeeId: string) {
    // Mock implementation - in real system would connect to CRM/sales data
    const target = 100000 // $100k target
    const actual = 85000 // $85k actual
    const achievement = (actual / target) * 100
    
    return {
      kpiId: 'revenue-achievement',
      name: 'Revenue Target Achievement',
      actualValue: achievement,
      targetValue: 100,
      score: this.calculateScore(achievement, 100),
      unit: 'percentage'
    }
  }
  
  async calculateLeadConversionRate(employeeId: string) {
    // Mock implementation
    const totalLeads = 200
    const convertedLeads = 30
    const conversionRate = (convertedLeads / totalLeads) * 100
    
    return {
      kpiId: 'lead-conversion',
      name: 'Lead Conversion Rate',
      actualValue: conversionRate,
      targetValue: 15,
      score: this.calculateScore(conversionRate, 15),
      unit: 'percentage'
    }
  }
  
  async calculateCustomerSatisfaction(employeeId: string) {
    // Mock implementation - would integrate with customer feedback system
    const averageRating = 4.2
    const targetRating = 4.5
    const achievement = (averageRating / targetRating) * 100
    
    return {
      kpiId: 'customer-satisfaction',
      name: 'Customer Satisfaction',
      actualValue: averageRating,
      targetValue: targetRating,
      score: this.calculateScore(achievement, 100),
      unit: 'rating'
    }
  }
  
  // ========== HELPER METHODS ==========
  
  private calculateScore(actual: number, target: number): number {
    const percentage = (actual / target) * 100
    
    if (percentage >= 100) return 5      // Exceeds expectations
    if (percentage >= 90) return 4       // Meets expectations
    if (percentage >= 80) return 3       // Partially meets
    if (percentage >= 70) return 2       // Below expectations
    return 1                             // Does not meet
  }
  
  private async getProductivityData(employeeId: string) {
    // Get productivity data from chrome extension tracking
    // This would integrate with the existing productivity service
    return {
      dailyFocusTime: 5.2 * 60, // 5.2 hours in minutes
      productiveWebsiteTime: 6.5 * 60, // 6.5 hours in minutes
      distractingWebsiteTime: 1.5 * 60, // 1.5 hours in minutes
      averageProductivityScore: 82
    }
  }
  
  // ========== BATCH PROCESSING ==========
  
  async processAllEmployeeKPIs(reviewPeriod: { start: Date; end: Date }) {
    try {
      // Get all employees
      const employeesSnapshot = await getDocs(collection(db, 'employees'))
      const employees = employeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      
      const results = []
      
      for (const employee of employees) {
        try {
          // Create performance review for the period
          const review = await performanceService.createPerformanceReview(
            employee.id,
            employee.managerId || 'system',
            {
              reviewPeriod,
              type: 'quarterly',
              dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 2 weeks from now
            }
          )
          
          // Calculate KPIs based on role
          let kpiScores = []
          
          if (employee.role === 'manager') {
            kpiScores = await this.calculateTeamLeadershipKPIs(employee.id, review.id)
          } else if (employee.department === 'sales') {
            kpiScores = await this.calculateSalesKPIs(employee.id, review.id)
          } else {
            kpiScores = await this.calculateProductivityKPIs(employee.id, review.id)
          }
          
          results.push({
            employeeId: employee.id,
            reviewId: review.id,
            kpiScores,
            status: 'success'
          })
        } catch (error) {
          console.error(`Error processing KPIs for employee ${employee.id}:`, error)
          results.push({
            employeeId: employee.id,
            status: 'error',
            error: error.message
          })
        }
      }
      
      return results
    } catch (error) {
      console.error('Error processing batch KPIs:', error)
      throw error
    }
  }
}

export const automatedKPICalculator = new AutomatedKPICalculator() 