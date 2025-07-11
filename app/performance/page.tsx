"use client"

import { useState, useEffect } from 'react'
import { useNewAuth } from '@/contexts/new-auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { 
  Target, 
  TrendingUp, 
  Users, 
  Star, 
  Calendar, 
  Award, 
  BarChart3, 
  Plus,
  Eye,
  Edit,
  CheckCircle,
  Clock,
  AlertCircle,
  MessageSquare,
  FileText,
  DollarSign,
  Trophy,
  TrendingDown
} from 'lucide-react'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts'
import { performanceService } from '@/lib/performance-service'
import { 
  PerformanceReview, 
  KPI, 
  Goal, 
  PerformanceAnalytics,
  KPICategory,
  KPIType,
  GoalCategory
} from '@/types/performance'
import { toast } from '@/components/ui/use-toast'
import { format } from 'date-fns'

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1']

export default function PerformancePage() {
  const { user, isLoading } = useNewAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [reviews, setReviews] = useState<PerformanceReview[]>([])
  const [kpis, setKPIs] = useState<KPI[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [analytics, setAnalytics] = useState<PerformanceAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateReviewModal, setShowCreateReviewModal] = useState(false)
  const [showCreateKPIModal, setShowCreateKPIModal] = useState(false)
  const [showCreateGoalModal, setShowCreateGoalModal] = useState(false)

  // Form states
  const [newReview, setNewReview] = useState({
    employeeId: '',
    type: 'annual' as const,
    dueDate: ''
  })
  const [newKPI, setNewKPI] = useState({
    name: '',
    description: '',
    category: KPICategory.PRODUCTIVITY,
    type: KPIType.PERCENTAGE,
    unit: '',
    target: 0,
    weight: 0
  })
  const [newGoal, setNewGoal] = useState({
    employeeId: '',
    title: '',
    description: '',
    category: GoalCategory.PERFORMANCE,
    priority: 'medium' as const,
    targetDate: ''
  })

  useEffect(() => {
    if (user?.uid) {
      loadPerformanceData()
    }
  }, [user])

  const loadPerformanceData = async () => {
    try {
      setLoading(true)
      
      // Load data based on user role
      if (user?.role === 'admin') {
        // Admin sees all performance data
        const [reviewsData, kpisData, analyticsData] = await Promise.all([
          performanceService.getManagerReviews(user.uid), // This should be modified to get all reviews for admin
          performanceService.getKPIs(),
          performanceService.getPerformanceAnalytics()
        ])
        setReviews(reviewsData)
        setKPIs(kpisData)
        setAnalytics(analyticsData)
      } else if (user?.role === 'manager') {
        // Manager sees team performance data
        const [reviewsData, kpisData, goalsData] = await Promise.all([
          performanceService.getManagerReviews(user.uid),
          performanceService.getKPIs(),
          performanceService.getEmployeeGoals(user.uid) // This should be modified to get team goals
        ])
        setReviews(reviewsData)
        setKPIs(kpisData)
        setGoals(goalsData)
      } else {
        // Employee sees own performance data
        const [reviewsData, goalsData] = await Promise.all([
          performanceService.getEmployeeReviews(user.uid),
          performanceService.getEmployeeGoals(user.uid)
        ])
        setReviews(reviewsData)
        setGoals(goalsData)
      }
    } catch (error) {
      console.error('Error loading performance data:', error)
      toast({
        title: "Error loading performance data",
        description: "Failed to load performance data. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateReview = async () => {
    try {
      if (!newReview.employeeId || !newReview.dueDate) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields.",
          variant: "destructive"
        })
        return
      }

      await performanceService.createPerformanceReview(
        newReview.employeeId,
        user!.uid,
        {
          type: newReview.type,
          dueDate: new Date(newReview.dueDate)
        }
      )

      toast({
        title: "Performance Review Created",
        description: "Performance review has been created successfully."
      })

      setShowCreateReviewModal(false)
      setNewReview({ employeeId: '', type: 'annual', dueDate: '' })
      loadPerformanceData()
    } catch (error) {
      toast({
        title: "Error creating review",
        description: "Failed to create performance review. Please try again.",
        variant: "destructive"
      })
    }
  }

  const handleCreateKPI = async () => {
    try {
      if (!newKPI.name || !newKPI.description || newKPI.target === 0) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields.",
          variant: "destructive"
        })
        return
      }

      await performanceService.createKPI({
        ...newKPI,
        calculationMethod: 'manual',
        isActive: true,
        validFrom: new Date(),
        createdBy: user!.uid,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      toast({
        title: "KPI Created",
        description: "KPI has been created successfully."
      })

      setShowCreateKPIModal(false)
      setNewKPI({
        name: '',
        description: '',
        category: KPICategory.PRODUCTIVITY,
        type: KPIType.PERCENTAGE,
        unit: '',
        target: 0,
        weight: 0
      })
      loadPerformanceData()
    } catch (error) {
      toast({
        title: "Error creating KPI",
        description: "Failed to create KPI. Please try again.",
        variant: "destructive"
      })
    }
  }

  const handleCreateGoal = async () => {
    try {
      if (!newGoal.title || !newGoal.description || !newGoal.targetDate) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields.",
          variant: "destructive"
        })
        return
      }

      await performanceService.createGoal({
        employeeId: newGoal.employeeId || user!.uid,
        title: newGoal.title,
        description: newGoal.description,
        category: newGoal.category,
        priority: newGoal.priority,
        startDate: new Date(),
        targetDate: new Date(newGoal.targetDate),
        status: 'not_started',
        progress: 0,
        measurementCriteria: '',
        successMetrics: [],
        requiredResources: [],
        supportNeeded: [],
        quarterlyReviews: [],
        linkedKPIs: [],
        createdBy: user!.uid,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      toast({
        title: "Goal Created",
        description: "Goal has been created successfully."
      })

      setShowCreateGoalModal(false)
      setNewGoal({
        employeeId: '',
        title: '',
        description: '',
        category: GoalCategory.PERFORMANCE,
        priority: 'medium',
        targetDate: ''
      })
      loadPerformanceData()
    } catch (error) {
      toast({
        title: "Error creating goal",
        description: "Failed to create goal. Please try again.",
        variant: "destructive"
      })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'draft': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />
      case 'in_progress': return <Clock className="h-4 w-4" />
      case 'pending': return <AlertCircle className="h-4 w-4" />
      default: return <FileText className="h-4 w-4" />
    }
  }

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return 'text-green-600'
    if (rating >= 3.5) return 'text-blue-600'
    if (rating >= 2.5) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Access Denied</h1>
          <p className="mt-2 text-gray-600">You must be signed in to view this page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Performance Management</h1>
          <p className="text-gray-600 mt-1">
            {user.role === 'admin' ? 'Manage company-wide performance' : 
             user.role === 'manager' ? 'Manage team performance' : 
             'Track your performance and goals'}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {(user.role === 'admin' || user.role === 'manager') && (
            <>
              <Button onClick={() => setShowCreateReviewModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Review
              </Button>
              <Button onClick={() => setShowCreateKPIModal(true)} variant="outline">
                <Target className="h-4 w-4 mr-2" />
                Create KPI
              </Button>
            </>
          )}
          <Button onClick={() => setShowCreateGoalModal(true)} variant="outline">
            <Trophy className="h-4 w-4 mr-2" />
            Create Goal
          </Button>
        </div>
      </div>

      {/* Performance Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Reviews</p>
                <p className="text-2xl font-bold text-gray-900">
                  {reviews.filter(r => r.status === 'in_progress').length}
                </p>
              </div>
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Goals</p>
                <p className="text-2xl font-bold text-gray-900">
                  {goals.filter(g => g.status === 'in_progress').length}
                </p>
              </div>
              <Target className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">KPIs</p>
                <p className="text-2xl font-bold text-gray-900">{kpis.length}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Rating</p>
                <p className="text-2xl font-bold text-gray-900">
                  {analytics?.averageRating ? analytics.averageRating.toFixed(1) : 'N/A'}
                </p>
              </div>
              <Star className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="kpis">KPIs</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Recent Reviews */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Recent Performance Reviews
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reviews.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No performance reviews found.</p>
              ) : (
                <div className="space-y-4">
                  {reviews.slice(0, 5).map((review) => (
                    <div key={review.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          {getStatusIcon(review.status)}
                        </div>
                        <div>
                          <h4 className="font-medium">{review.type.replace('_', ' ').toUpperCase()} Review</h4>
                          <p className="text-sm text-gray-600">
                            Due: {format(review.dueDate, 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getStatusColor(review.status)}>
                          {review.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                        {review.overallRating > 0 && (
                          <div className="flex items-center space-x-1">
                            <Star className="h-4 w-4 text-yellow-500" />
                            <span className={`font-medium ${getRatingColor(review.overallRating)}`}>
                              {review.overallRating.toFixed(1)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Goal Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Target className="h-5 w-5 mr-2" />
                Goal Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              {goals.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No goals found.</p>
              ) : (
                <div className="space-y-4">
                  {goals.slice(0, 5).map((goal) => (
                    <div key={goal.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{goal.title}</h4>
                        <Badge className={getStatusColor(goal.status)}>
                          {goal.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>
                      <Progress value={goal.progress} className="h-2" />
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>{goal.progress}% Complete</span>
                        <span>Due: {format(goal.targetDate, 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              {reviews.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Reviews Found</h3>
                  <p className="text-gray-600 mb-4">
                    {user.role === 'employee' 
                      ? "You don't have any performance reviews yet." 
                      : "Create your first performance review to get started."}
                  </p>
                  {(user.role === 'admin' || user.role === 'manager') && (
                    <Button onClick={() => setShowCreateReviewModal(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Review
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div key={review.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-lg">
                            {review.type.replace('_', ' ').toUpperCase()} Review
                          </h3>
                          <p className="text-sm text-gray-600">
                            Period: {format(review.reviewPeriod.start, 'MMM d')} - {format(review.reviewPeriod.end, 'MMM d, yyyy')}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className={getStatusColor(review.status)}>
                            {review.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                          {review.overallRating > 0 && (
                            <div className="flex items-center space-x-1">
                              <Star className="h-4 w-4 text-yellow-500" />
                              <span className={`font-medium ${getRatingColor(review.overallRating)}`}>
                                {review.overallRating.toFixed(1)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Due Date:</span>
                          <p className="text-gray-600">{format(review.dueDate, 'MMM d, yyyy')}</p>
                        </div>
                        <div>
                          <span className="font-medium">KPI Scores:</span>
                          <p className="text-gray-600">{review.kpiScores.length} metrics</p>
                        </div>
                        <div>
                          <span className="font-medium">360° Feedback:</span>
                          <p className="text-gray-600">{review.feedback360.length} responses</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kpis" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Key Performance Indicators</CardTitle>
            </CardHeader>
            <CardContent>
              {kpis.length === 0 ? (
                <div className="text-center py-8">
                  <Target className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No KPIs Found</h3>
                  <p className="text-gray-600 mb-4">Create KPIs to track performance metrics.</p>
                  {(user.role === 'admin' || user.role === 'manager') && (
                    <Button onClick={() => setShowCreateKPIModal(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create KPI
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {kpis.map((kpi) => (
                    <div key={kpi.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{kpi.name}</h3>
                        <Badge variant="outline">
                          {kpi.category.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{kpi.description}</p>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Target: {kpi.target} {kpi.unit}</span>
                        <span className="font-medium">Weight: {kpi.weight}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="goals" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Goals & Objectives</CardTitle>
            </CardHeader>
            <CardContent>
              {goals.length === 0 ? (
                <div className="text-center py-8">
                  <Trophy className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Goals Found</h3>
                  <p className="text-gray-600 mb-4">Set goals to track your progress and achievements.</p>
                  <Button onClick={() => setShowCreateGoalModal(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Goal
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {goals.map((goal) => (
                    <div key={goal.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold">{goal.title}</h3>
                        <div className="flex items-center space-x-2">
                          <Badge className={getStatusColor(goal.status)}>
                            {goal.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                          <Badge variant="outline" className={
                            goal.priority === 'high' ? 'border-red-200 text-red-800' :
                            goal.priority === 'medium' ? 'border-yellow-200 text-yellow-800' :
                            'border-green-200 text-green-800'
                          }>
                            {goal.priority.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{goal.description}</p>
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">Progress</span>
                          <span className="text-sm text-gray-600">{goal.progress}%</span>
                        </div>
                        <Progress value={goal.progress} className="h-2" />
                      </div>
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <span>Started: {format(goal.startDate, 'MMM d, yyyy')}</span>
                        <span>Due: {format(goal.targetDate, 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics ? (
                <div className="space-y-6">
                  {/* Rating Distribution */}
                  <div>
                    <h3 className="font-semibold mb-4">Rating Distribution</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analytics.ratingDistribution}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ rating, percentage }) => `${rating} Stars: ${percentage.toFixed(1)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="count"
                          >
                            {analytics.ratingDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Performance Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-semibold text-blue-900">Total Reviews</h4>
                      <p className="text-2xl font-bold text-blue-700">{analytics.totalReviews}</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <h4 className="font-semibold text-green-900">Completed</h4>
                      <p className="text-2xl font-bold text-green-700">{analytics.completedReviews}</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <h4 className="font-semibold text-purple-900">Average Rating</h4>
                      <p className="text-2xl font-bold text-purple-700">{analytics.averageRating.toFixed(1)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Analytics Available</h3>
                  <p className="text-gray-600">Complete more performance reviews to see analytics.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Review Modal */}
      <Dialog open={showCreateReviewModal} onOpenChange={setShowCreateReviewModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Performance Review</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="employeeId">Employee ID</Label>
              <Input
                id="employeeId"
                value={newReview.employeeId}
                onChange={(e) => setNewReview(prev => ({ ...prev, employeeId: e.target.value }))}
                placeholder="Enter employee ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Review Type</Label>
              <Select value={newReview.type} onValueChange={(value) => setNewReview(prev => ({ ...prev, type: value as any }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select review type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">Annual Review</SelectItem>
                  <SelectItem value="quarterly">Quarterly Review</SelectItem>
                  <SelectItem value="mid_year">Mid-Year Review</SelectItem>
                  <SelectItem value="probationary">Probationary Review</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={newReview.dueDate}
                onChange={(e) => setNewReview(prev => ({ ...prev, dueDate: e.target.value }))}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setShowCreateReviewModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateReview}>
                Create Review
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create KPI Modal */}
      <Dialog open={showCreateKPIModal} onOpenChange={setShowCreateKPIModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create KPI</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="kpiName">KPI Name</Label>
              <Input
                id="kpiName"
                value={newKPI.name}
                onChange={(e) => setNewKPI(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter KPI name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kpiDescription">Description</Label>
              <Textarea
                id="kpiDescription"
                value={newKPI.description}
                onChange={(e) => setNewKPI(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter KPI description"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="kpiCategory">Category</Label>
                <Select value={newKPI.category} onValueChange={(value) => setNewKPI(prev => ({ ...prev, category: value as KPICategory }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(KPICategory).map((category) => (
                      <SelectItem key={category} value={category}>
                        {category.replace('_', ' ').toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="kpiType">Type</Label>
                <Select value={newKPI.type} onValueChange={(value) => setNewKPI(prev => ({ ...prev, type: value as KPIType }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(KPIType).map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.replace('_', ' ').toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="kpiUnit">Unit</Label>
                <Input
                  id="kpiUnit"
                  value={newKPI.unit}
                  onChange={(e) => setNewKPI(prev => ({ ...prev, unit: e.target.value }))}
                  placeholder="e.g., %, hours"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kpiTarget">Target</Label>
                <Input
                  id="kpiTarget"
                  type="number"
                  value={newKPI.target}
                  onChange={(e) => setNewKPI(prev => ({ ...prev, target: parseFloat(e.target.value) || 0 }))}
                  placeholder="Target value"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kpiWeight">Weight (%)</Label>
                <Input
                  id="kpiWeight"
                  type="number"
                  value={newKPI.weight}
                  onChange={(e) => setNewKPI(prev => ({ ...prev, weight: parseFloat(e.target.value) || 0 }))}
                  placeholder="Weight"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setShowCreateKPIModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateKPI}>
                Create KPI
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Goal Modal */}
      <Dialog open={showCreateGoalModal} onOpenChange={setShowCreateGoalModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Goal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {(user.role === 'admin' || user.role === 'manager') && (
              <div className="space-y-2">
                <Label htmlFor="goalEmployeeId">Employee ID (leave empty for yourself)</Label>
                <Input
                  id="goalEmployeeId"
                  value={newGoal.employeeId}
                  onChange={(e) => setNewGoal(prev => ({ ...prev, employeeId: e.target.value }))}
                  placeholder="Enter employee ID"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="goalTitle">Goal Title</Label>
              <Input
                id="goalTitle"
                value={newGoal.title}
                onChange={(e) => setNewGoal(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter goal title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goalDescription">Description</Label>
              <Textarea
                id="goalDescription"
                value={newGoal.description}
                onChange={(e) => setNewGoal(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter goal description"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="goalCategory">Category</Label>
                <Select value={newGoal.category} onValueChange={(value) => setNewGoal(prev => ({ ...prev, category: value as GoalCategory }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(GoalCategory).map((category) => (
                      <SelectItem key={category} value={category}>
                        {category.replace('_', ' ').toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="goalPriority">Priority</Label>
                <Select value={newGoal.priority} onValueChange={(value) => setNewGoal(prev => ({ ...prev, priority: value as any }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="goalTargetDate">Target Date</Label>
              <Input
                id="goalTargetDate"
                type="date"
                value={newGoal.targetDate}
                onChange={(e) => setNewGoal(prev => ({ ...prev, targetDate: e.target.value }))}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setShowCreateGoalModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateGoal}>
                Create Goal
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
} 