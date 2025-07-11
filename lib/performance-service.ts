import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  serverTimestamp,
  QueryDocumentSnapshot,
  DocumentData,
  writeBatch
} from 'firebase/firestore'
import { db } from './firebase'
import { 
  PerformanceReview, 
  KPI, 
  KPIScore, 
  Feedback360, 
  Goal, 
  DevelopmentPlan, 
  SalaryReview, 
  SelfAssessment, 
  PerformanceAnalytics,
  PerformanceSettings,
  FeedbackCriteria,
  Rating,
  KPICategory,
  KPIType,
  GoalCategory
} from '@/types/performance'
import { createNotification } from './notifications'

export class PerformanceService {
  
  // ========== PERFORMANCE REVIEW MANAGEMENT ==========
  
  async createPerformanceReview(
    employeeId: string,
    reviewerId: string,
    reviewData: Partial<PerformanceReview>
  ): Promise<PerformanceReview> {
    try {
      const review: Omit<PerformanceReview, 'id'> = {
        employeeId,
        reviewerId,
        reviewPeriod: reviewData.reviewPeriod || {
          start: new Date(new Date().getFullYear(), 0, 1),
          end: new Date(new Date().getFullYear(), 11, 31)
        },
        status: 'draft',
        type: reviewData.type || 'annual',
        overallRating: 0,
        overallComments: '',
        kpiScores: [],
        feedback360: [],
        previousGoals: [],
        newGoals: [],
        developmentPlan: {
          id: '',
          employeeId,
          reviewId: '',
          developmentAreas: [],
          careerGoals: [],
          promotionReadiness: 'not_ready',
          trainingNeeds: [],
          recommendedCourses: [],
          mentoring: {
            hasMentor: false,
            mentorshipGoals: []
          },
          timeline: [],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        dueDate: reviewData.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        managerComments: '',
        managerRecommendations: [],
        ...reviewData
      }

      const docRef = await addDoc(collection(db, 'performance_reviews'), review)
      const performanceReview = { id: docRef.id, ...review }

      // Send notification to employee
      await createNotification({
        type: 'custom',
        message: `Performance Review Started: Your ${review.type} performance review has been initiated.`,
        severity: 'info',
        employeeId,
        data: { reviewId: docRef.id }
      })

      return performanceReview
    } catch (error) {
      console.error('Error creating performance review:', error)
      throw error
    }
  }

  async getPerformanceReview(reviewId: string): Promise<PerformanceReview | null> {
    try {
      const docRef = doc(db, 'performance_reviews', reviewId)
      const docSnap = await getDoc(docRef)

      if (!docSnap.exists()) {
        return null
      }

      return { id: docSnap.id, ...docSnap.data() } as PerformanceReview
    } catch (error) {
      console.error('Error getting performance review:', error)
      throw error
    }
  }

  async updatePerformanceReview(
    reviewId: string, 
    updates: Partial<PerformanceReview>
  ): Promise<PerformanceReview> {
    try {
      const docRef = doc(db, 'performance_reviews', reviewId)
      const updateData = {
        ...updates,
        updatedAt: serverTimestamp()
      }

      await updateDoc(docRef, updateData)
      
      const updated = await this.getPerformanceReview(reviewId)
      if (!updated) throw new Error('Review not found after update')

      return updated
    } catch (error) {
      console.error('Error updating performance review:', error)
      throw error
    }
  }

  async getEmployeeReviews(employeeId: string): Promise<PerformanceReview[]> {
    try {
      const q = query(
        collection(db, 'performance_reviews'),
        where('employeeId', '==', employeeId),
        orderBy('createdAt', 'desc')
      )
      
      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PerformanceReview[]
    } catch (error) {
      console.error('Error getting employee reviews:', error)
      throw error
    }
  }

  async getManagerReviews(managerId: string): Promise<PerformanceReview[]> {
    try {
      const q = query(
        collection(db, 'performance_reviews'),
        where('reviewerId', '==', managerId),
        orderBy('createdAt', 'desc')
      )
      
      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PerformanceReview[]
    } catch (error) {
      console.error('Error getting manager reviews:', error)
      throw error
    }
  }

  // ========== KPI MANAGEMENT ==========

  async createKPI(kpiData: Omit<KPI, 'id'>): Promise<KPI> {
    try {
      const docRef = await addDoc(collection(db, 'kpis'), {
        ...kpiData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
      
      return { id: docRef.id, ...kpiData }
    } catch (error) {
      console.error('Error creating KPI:', error)
      throw error
    }
  }

  async getKPIs(departmentId?: string): Promise<KPI[]> {
    try {
      let q = query(collection(db, 'kpis'), where('isActive', '==', true))
      
      if (departmentId) {
        q = query(q, where('departmentId', '==', departmentId))
      }
      
      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as KPI[]
    } catch (error) {
      console.error('Error getting KPIs:', error)
      throw error
    }
  }

  async calculateKPIScore(
    employeeId: string,
    kpiId: string,
    actualValue: number,
    reviewId: string
  ): Promise<KPIScore> {
    try {
      const kpi = await this.getKPI(kpiId)
      if (!kpi) throw new Error('KPI not found')

      const percentage = (actualValue / kpi.target) * 100
      let score = 0

      // Score calculation based on percentage achievement
      if (percentage >= 100) score = 5
      else if (percentage >= 90) score = 4
      else if (percentage >= 80) score = 3
      else if (percentage >= 70) score = 2
      else score = 1

      const kpiScore: Omit<KPIScore, 'id'> = {
        kpiId,
        employeeId,
        reviewId,
        actualValue,
        targetValue: kpi.target,
        score,
        percentage,
        periodStart: new Date(new Date().getFullYear(), 0, 1),
        periodEnd: new Date(new Date().getFullYear(), 11, 31),
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const docRef = await addDoc(collection(db, 'kpi_scores'), kpiScore)
      return { id: docRef.id, ...kpiScore }
    } catch (error) {
      console.error('Error calculating KPI score:', error)
      throw error
    }
  }

  async getKPI(kpiId: string): Promise<KPI | null> {
    try {
      const docRef = doc(db, 'kpis', kpiId)
      const docSnap = await getDoc(docRef)

      if (!docSnap.exists()) {
        return null
      }

      return { id: docSnap.id, ...docSnap.data() } as KPI
    } catch (error) {
      console.error('Error getting KPI:', error)
      throw error
    }
  }

  // ========== 360 FEEDBACK MANAGEMENT ==========

  async initiate360Feedback(
    reviewId: string,
    employeeId: string,
    feedbackProviders: { providerId: string; providerType: string }[]
  ): Promise<Feedback360[]> {
    try {
      const batch = writeBatch(db)
      const feedback360List: Feedback360[] = []

      for (const provider of feedbackProviders) {
        const feedback360Data: Omit<Feedback360, 'id'> = {
          reviewId,
          employeeId,
          providerId: provider.providerId,
          providerType: provider.providerType as any,
          ratings: [],
          strengths: '',
          areasForImprovement: '',
          generalComments: '',
          status: 'pending',
          isAnonymous: provider.providerType === 'peer',
          createdAt: new Date(),
          updatedAt: new Date()
        }

        const docRef = doc(collection(db, 'feedback_360'))
        batch.set(docRef, feedback360Data)
        
        feedback360List.push({ id: docRef.id, ...feedback360Data })

        // Send notification to feedback provider
        await createNotification({
          type: 'custom',
          message: `360° Feedback Request: You have been requested to provide feedback for a team member.`,
          severity: 'info',
          employeeId: provider.providerId,
          data: { feedbackId: docRef.id, employeeId }
        })
      }

      await batch.commit()
      return feedback360List
    } catch (error) {
      console.error('Error initiating 360 feedback:', error)
      throw error
    }
  }

  async submitFeedback360(
    feedbackId: string,
    ratings: Rating[],
    comments: {
      strengths: string
      areasForImprovement: string
      generalComments: string
    }
  ): Promise<Feedback360> {
    try {
      const docRef = doc(db, 'feedback_360', feedbackId)
      
      const updateData = {
        ratings,
        strengths: comments.strengths,
        areasForImprovement: comments.areasForImprovement,
        generalComments: comments.generalComments,
        status: 'completed',
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }

      await updateDoc(docRef, updateData)
      
      const feedback = await this.getFeedback360(feedbackId)
      if (!feedback) throw new Error('Feedback not found after update')

      return feedback
    } catch (error) {
      console.error('Error submitting 360 feedback:', error)
      throw error
    }
  }

  async getFeedback360(feedbackId: string): Promise<Feedback360 | null> {
    try {
      const docRef = doc(db, 'feedback_360', feedbackId)
      const docSnap = await getDoc(docRef)

      if (!docSnap.exists()) {
        return null
      }

      return { id: docSnap.id, ...docSnap.data() } as Feedback360
    } catch (error) {
      console.error('Error getting 360 feedback:', error)
      throw error
    }
  }

  // ========== GOAL MANAGEMENT ==========

  async createGoal(goalData: Omit<Goal, 'id'>): Promise<Goal> {
    try {
      const docRef = await addDoc(collection(db, 'goals'), {
        ...goalData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
      
      const goal = { id: docRef.id, ...goalData }

      // Send notification to employee
      await createNotification({
        type: 'custom',
        message: `New Goal Assigned: A new goal "${goalData.title}" has been assigned to you.`,
        severity: 'info',
        employeeId: goalData.employeeId,
        data: { goalId: docRef.id }
      })

      return goal
    } catch (error) {
      console.error('Error creating goal:', error)
      throw error
    }
  }

  async updateGoalProgress(
    goalId: string, 
    progress: number, 
    notes?: string
  ): Promise<Goal> {
    try {
      const docRef = doc(db, 'goals', goalId)
      const updateData: any = {
        progress,
        updatedAt: serverTimestamp()
      }

      if (progress === 100) {
        updateData.status = 'completed'
        updateData.completedDate = serverTimestamp()
      }

      await updateDoc(docRef, updateData)
      
      const goal = await this.getGoal(goalId)
      if (!goal) throw new Error('Goal not found after update')

      return goal
    } catch (error) {
      console.error('Error updating goal progress:', error)
      throw error
    }
  }

  async getGoal(goalId: string): Promise<Goal | null> {
    try {
      const docRef = doc(db, 'goals', goalId)
      const docSnap = await getDoc(docRef)

      if (!docSnap.exists()) {
        return null
      }

      return { id: docSnap.id, ...docSnap.data() } as Goal
    } catch (error) {
      console.error('Error getting goal:', error)
      throw error
    }
  }

  async getEmployeeGoals(employeeId: string): Promise<Goal[]> {
    try {
      const q = query(
        collection(db, 'goals'),
        where('employeeId', '==', employeeId),
        orderBy('createdAt', 'desc')
      )
      
      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Goal[]
    } catch (error) {
      console.error('Error getting employee goals:', error)
      throw error
    }
  }

  // ========== SALARY REVIEW INTEGRATION ==========

  async createSalaryReview(
    employeeId: string,
    reviewId: string,
    salaryData: Omit<SalaryReview, 'id' | 'employeeId' | 'reviewId'>
  ): Promise<SalaryReview> {
    try {
      const review: Omit<SalaryReview, 'id'> = {
        employeeId,
        reviewId,
        ...salaryData,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const docRef = await addDoc(collection(db, 'salary_reviews'), review)
      const salaryReview = { id: docRef.id, ...review }

      // Send notification to HR
      await createNotification({
        type: 'custom',
        message: `Salary Review Requested: A salary review has been requested for employee ${employeeId}.`,
        severity: 'warning',
        employeeId: 'hr',
        data: { salaryReviewId: docRef.id, employeeId }
      })

      return salaryReview
    } catch (error) {
      console.error('Error creating salary review:', error)
      throw error
    }
  }

  // ========== PERFORMANCE ANALYTICS ==========

  async getPerformanceAnalytics(
    departmentId?: string,
    period?: { start: Date; end: Date }
  ): Promise<PerformanceAnalytics> {
    try {
      let reviewsQuery = query(
        collection(db, 'performance_reviews'),
        where('status', '==', 'completed')
      )

      if (period) {
        reviewsQuery = query(
          reviewsQuery,
          where('completedAt', '>=', period.start),
          where('completedAt', '<=', period.end)
        )
      }

      const reviewsSnapshot = await getDocs(reviewsQuery)
      const reviews = reviewsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PerformanceReview[]

      // Calculate analytics
      const totalReviews = reviews.length
      const completedReviews = reviews.filter(r => r.status === 'completed').length
      const averageRating = reviews.reduce((sum, r) => sum + r.overallRating, 0) / totalReviews || 0

      // Rating distribution
      const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      reviews.forEach(r => {
        const rating = Math.round(r.overallRating)
        if (rating >= 1 && rating <= 5) {
          ratingCounts[rating as keyof typeof ratingCounts]++
        }
      })

      const ratingDistribution = Object.entries(ratingCounts).map(([rating, count]) => ({
        rating: parseInt(rating),
        count,
        percentage: totalReviews > 0 ? (count / totalReviews) * 100 : 0
      }))

      return {
        totalReviews,
        completedReviews,
        averageRating,
        ratingDistribution,
        departmentPerformance: [],
        kpiPerformance: [],
        performanceTrends: [],
        topPerformers: [],
        commonDevelopmentAreas: [],
        salaryImpact: {
          totalIncreases: 0,
          averageIncrease: 0,
          budgetImpact: 0
        }
      }
    } catch (error) {
      console.error('Error getting performance analytics:', error)
      throw error
    }
  }

  // ========== SELF-ASSESSMENT ==========

  async createSelfAssessment(
    employeeId: string,
    reviewId: string,
    assessmentData: Omit<SelfAssessment, 'id' | 'employeeId' | 'reviewId'>
  ): Promise<SelfAssessment> {
    try {
      const assessment: Omit<SelfAssessment, 'id'> = {
        employeeId,
        reviewId,
        ...assessmentData,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const docRef = await addDoc(collection(db, 'self_assessments'), assessment)
      return { id: docRef.id, ...assessment }
    } catch (error) {
      console.error('Error creating self-assessment:', error)
      throw error
    }
  }

  // ========== FEEDBACK CRITERIA MANAGEMENT ==========

  async getFeedbackCriteria(departmentId?: string): Promise<FeedbackCriteria[]> {
    try {
      let q = query(
        collection(db, 'feedback_criteria'),
        where('isActive', '==', true)
      )

      if (departmentId) {
        q = query(q, where('departmentId', '==', departmentId))
      }

      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FeedbackCriteria[]
    } catch (error) {
      console.error('Error getting feedback criteria:', error)
      throw error
    }
  }

  // ========== PERFORMANCE INTEGRATION WITH PRODUCTIVITY ==========

  async integrateProductivityData(
    employeeId: string,
    reviewId: string
  ): Promise<{ productivityScore: number; attendanceScore: number }> {
    try {
      // This would integrate with the existing productivity service
      // For now, we'll return mock data
      return {
        productivityScore: 85,
        attendanceScore: 95
      }
    } catch (error) {
      console.error('Error integrating productivity data:', error)
      throw error
    }
  }
}

// Export singleton instance
export const performanceService = new PerformanceService() 