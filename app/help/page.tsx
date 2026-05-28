'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Search, 
  HelpCircle, 
  CreditCard, 
  Users, 
  User,
  Calculator, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Phone,
  Building,
  DollarSign,
  Settings,
  FileText,
  Download,
  RefreshCw,
  Clock,
  Calendar
} from 'lucide-react'

export default function HelpPage() {
  const [searchTerm, setSearchTerm] = useState('')

  const faqData = [
    {
      category: 'Getting Started',
      icon: <User className="h-5 w-5" />,
      questions: [
        {
          question: 'How do I log in to the system?',
          answer: 'Use your email and password to sign in at the login page. If you\'re a new user, contact your administrator for account setup.',
          tags: ['login', 'authentication', 'account']
        },
        {
          question: 'What are the different user roles?',
          answer: 'There are three roles: Admin (full access), Manager (team management), and Employee (personal features). Your role determines which features you can access.',
          tags: ['roles', 'permissions', 'access']
        },
        {
          question: 'How do I update my profile information?',
          answer: 'Go to Profile → Edit your personal details, contact information, and preferences. Changes are saved automatically.',
          tags: ['profile', 'personal info', 'settings']
        },
        {
          question: 'Where can I find my dashboard?',
          answer: 'Your dashboard is the main page after login. It shows personalized information based on your role and recent activity.',
          tags: ['dashboard', 'home', 'overview']
        }
      ]
    },
    {
      category: 'Attendance Management',
      icon: <Clock className="h-5 w-5" />,
      questions: [
        {
          question: 'How do I check in for work?',
          answer: 'Go to Attendance → Click "Check In" button. The system records your start time and location automatically.',
          tags: ['check in', 'attendance', 'time tracking']
        },
        {
          question: 'How do I check out at the end of the day?',
          answer: 'Go to Attendance → Click "Check Out" button. Your total hours worked will be calculated automatically.',
          tags: ['check out', 'hours', 'end of day']
        },
        {
          question: 'Can I view my attendance history?',
          answer: 'Yes! Go to Attendance → View your daily records, weekly summaries, and monthly reports. You can filter by date range.',
          tags: ['history', 'reports', 'records']
        },
        {
          question: 'What if I forget to check in or out?',
          answer: 'Contact your manager or HR to manually adjust your attendance record. The system tracks idle time to help verify work hours.',
          tags: ['forgot', 'manual adjustment', 'idle time']
        },
        {
          question: 'How does idle time tracking work?',
          answer: 'The system monitors computer activity during work hours. Extended idle periods are flagged for review to ensure accurate time tracking.',
          tags: ['idle time', 'activity monitoring', 'productivity']
        }
      ]
    },
    {
      category: 'Task Management',
      icon: <FileText className="h-5 w-5" />,
      questions: [
        {
          question: 'How do I create a new task?',
          answer: 'Go to Tasks → Click "Create Task" → Fill in task details, assignee, due date, and priority → Save. Tasks can be assigned to yourself or team members.',
          tags: ['create task', 'assign', 'due date']
        },
        {
          question: 'How do I view my assigned tasks?',
          answer: 'Go to Tasks or My Tasks → View all tasks assigned to you. Use filters to see pending, completed, or overdue tasks.',
          tags: ['my tasks', 'assigned', 'filter']
        },
        {
          question: 'How do I mark a task as complete?',
          answer: 'Find your task in the task list → Click "Complete" button → Add completion notes if required → Confirm completion.',
          tags: ['complete', 'finish', 'status']
        },
        {
          question: 'Can I set task priorities and deadlines?',
          answer: 'Yes! When creating tasks, you can set priority levels (Low, Medium, High, Urgent) and specific due dates for better organization.',
          tags: ['priority', 'deadline', 'organization']
        },
        {
          question: 'How do I track task progress?',
          answer: 'Use the task dashboard to see completion rates, overdue tasks, and team productivity metrics. Managers can view team-wide task status.',
          tags: ['progress', 'metrics', 'team view']
        }
      ]
    },
    {
      category: 'Leave Management',
      icon: <Calendar className="h-5 w-5" />,
      questions: [
        {
          question: 'How do I request time off?',
          answer: 'Go to Leave → Click "Request Leave" → Select leave type, dates, and reason → Submit for approval. Your manager will review the request.',
          tags: ['request leave', 'time off', 'approval']
        },
        {
          question: 'What types of leave are available?',
          answer: 'Common leave types include vacation, sick leave, personal days, and holidays. Available types depend on your company policy.',
          tags: ['leave types', 'vacation', 'sick leave']
        },
        {
          question: 'How do I check my leave balance?',
          answer: 'Go to Leave → View your remaining leave days for each type. The balance updates automatically when leave is approved or taken.',
          tags: ['balance', 'remaining days', 'tracking']
        },
        {
          question: 'How do I approve leave requests? (Managers)',
          answer: 'Go to Leave → View pending requests → Review details → Approve or reject with comments. Employees will be notified of the decision.',
          tags: ['approve', 'manager', 'pending requests']
        },
        {
          question: 'Can I cancel a leave request?',
          answer: 'Yes, if the request is still pending approval. Go to Leave → Find your request → Click "Cancel" before it\'s approved.',
          tags: ['cancel', 'pending', 'modify']
        }
      ]
    },
    {
      category: 'Payroll & Payments',
      icon: <DollarSign className="h-5 w-5" />,
      questions: [
        {
          question: 'How do I process payroll for employees?',
          answer: 'Go to Payroll → Select employees → Set salaries → Process payments. The system calculates deductions automatically and sends payments via Paystack.',
          tags: ['payroll', 'process', 'payments']
        },
        {
          question: 'What payment methods are supported?',
          answer: 'Mobile Money (MTN, Vodafone, AirtelTigo) and Bank Transfers via Paystack. The system detects the provider automatically.',
          tags: ['mobile money', 'bank transfer', 'paystack']
        },
        {
          question: 'How do I view my payslip?',
          answer: 'Go to Payslip → View your salary breakdown, deductions, and net pay. Payslips are generated automatically after payroll processing.',
          tags: ['payslip', 'salary', 'deductions']
        },
        {
          question: 'What deductions are calculated?',
          answer: 'Standard deductions include Tax (20%), Insurance (10%), and Pension (5%). Rates can be adjusted in payroll settings.',
          tags: ['deductions', 'tax', 'calculations']
        },
        {
          question: 'How do I track payment status?',
          answer: 'Use the Payment Status tracker to see real-time payment updates, retry failed payments, and download payment reports.',
          tags: ['payment status', 'tracking', 'reports']
        }
      ]
    },
    {
      category: 'Employee Management',
      icon: <Users className="h-5 w-5" />,
      questions: [
        {
          question: 'How do I add a new employee? (Admins)',
          answer: 'Go to Employees → Add Employee → Fill in personal details, role, department, and salary → Save. The employee will receive login credentials.',
          tags: ['add employee', 'new hire', 'onboarding']
        },
        {
          question: 'How do I manage employee information?',
          answer: 'Go to Employees → Select employee → Edit profile, update role, change department, or modify salary information as needed.',
          tags: ['edit employee', 'update info', 'management']
        },
        {
          question: 'How do I organize employees by department?',
          answer: 'Use the Departments section to create and manage departments. Assign employees to departments for better organization.',
          tags: ['departments', 'organization', 'structure']
        },
        {
          question: 'How do I view team productivity? (Managers)',
          answer: 'Go to Productivity → View team metrics, task completion rates, attendance patterns, and performance indicators for your team.',
          tags: ['productivity', 'team metrics', 'performance']
        },
        {
          question: 'How do I monitor employee activity?',
          answer: 'Use the Monitoring section to track employee activity, attendance patterns, and productivity metrics in real-time.',
          tags: ['monitoring', 'activity', 'real-time']
        }
      ]
    },
    {
      category: 'Performance & Reports',
      icon: <Building className="h-5 w-5" />,
      questions: [
        {
          question: 'How do I view performance reports?',
          answer: 'Go to Performance → Access detailed reports on employee productivity, attendance, task completion, and other key metrics.',
          tags: ['performance', 'reports', 'metrics']
        },
        {
          question: 'How do I generate attendance reports?',
          answer: 'Go to Attendance → Reports → Select date range and filters → Generate reports for individuals or teams.',
          tags: ['attendance reports', 'date range', 'filters']
        },
        {
          question: 'Can I export data for external analysis?',
          answer: 'Yes! Most report sections include export options for CSV, PDF, or Excel formats for further analysis.',
          tags: ['export', 'csv', 'pdf', 'excel']
        },
        {
          question: 'How do I track team performance? (Managers)',
          answer: 'Use the Performance dashboard to view team metrics, compare individual performance, and identify areas for improvement.',
          tags: ['team performance', 'comparison', 'improvement']
        }
      ]
    },
    {
      category: 'System Settings',
      icon: <Settings className="h-5 w-5" />,
      questions: [
        {
          question: 'How do I change my password?',
          answer: 'Go to Settings → Security → Change Password → Enter current and new password → Save changes.',
          tags: ['password', 'security', 'change']
        },
        {
          question: 'How do I configure system preferences?',
          answer: 'Go to Settings → System Preferences → Adjust notification settings, time zones, and other system-wide configurations.',
          tags: ['preferences', 'notifications', 'timezone']
        },
        {
          question: 'How do I manage user permissions? (Admins)',
          answer: 'Go to Settings → User Management → Assign roles, modify permissions, and control access to different system features.',
          tags: ['permissions', 'roles', 'access control']
        },
        {
          question: 'How do I backup system data?',
          answer: 'System backups are handled automatically. Contact your system administrator for manual backup requests or data export.',
          tags: ['backup', 'data export', 'system admin']
        }
      ]
    },
    {
      category: 'Troubleshooting',
      icon: <AlertTriangle className="h-5 w-5" />,
      questions: [
        {
          question: 'I can\'t log in to my account',
          answer: 'Check your email and password. If forgotten, use "Forgot Password" or contact your administrator for account reset.',
          tags: ['login issues', 'password', 'account reset']
        },
        {
          question: 'The system is running slowly',
          answer: 'Try refreshing the page, clearing browser cache, or checking your internet connection. Contact support if issues persist.',
          tags: ['slow performance', 'browser cache', 'internet']
        },
        {
          question: 'I can\'t see certain features',
          answer: 'Your role determines feature access. Contact your administrator if you believe you should have access to additional features.',
          tags: ['missing features', 'role permissions', 'access']
        },
        {
          question: 'Data is not saving properly',
          answer: 'Check your internet connection and try again. If problems persist, contact support with details about what you were trying to save.',
          tags: ['data not saving', 'connection', 'support']
        },
        {
          question: 'I\'m getting error messages',
          answer: 'Note the exact error message and contact support. Include what you were doing when the error occurred for faster resolution.',
          tags: ['error messages', 'support', 'troubleshooting']
        }
      ]
    }
  ]

  const filteredFAQs = faqData.map(category => ({
    ...category,
    questions: category.questions.filter(q => 
      q.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.answer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  })).filter(category => category.questions.length > 0)

  const quickActions = [
    {
      title: 'Check In/Out',
      description: 'Record your work hours',
      icon: <Clock className="h-6 w-6" />,
      action: 'Go to Attendance'
    },
    {
      title: 'Create Task',
      description: 'Assign new tasks to team members',
      icon: <FileText className="h-6 w-6" />,
      action: 'Go to Tasks'
    },
    {
      title: 'Request Leave',
      description: 'Submit time off requests',
      icon: <Calendar className="h-6 w-6" />,
      action: 'Go to Leave'
    },
    {
      title: 'Process Payroll',
      description: 'Run payroll for employees',
      icon: <DollarSign className="h-6 w-6" />,
      action: 'Go to Payroll'
    },
    {
      title: 'View Reports',
      description: 'Access performance and attendance reports',
      icon: <Building className="h-6 w-6" />,
      action: 'Go to Performance'
    },
    {
      title: 'Manage Employees',
      description: 'Add or update employee information',
      icon: <Users className="h-6 w-6" />,
      action: 'Go to Employees'
    }
  ]

  const statusIndicators = [
    {
      status: 'Success',
      icon: <CheckCircle className="h-4 w-4 text-green-600" />,
      description: 'Action completed successfully'
    },
    {
      status: 'Pending',
      icon: <RefreshCw className="h-4 w-4 text-yellow-600" />,
      description: 'Action is being processed'
    },
    {
      status: 'Failed',
      icon: <XCircle className="h-4 w-4 text-red-600" />,
      description: 'Action failed - can be retried'
    },
    {
      status: 'Approved',
      icon: <CheckCircle className="h-4 w-4 text-green-600" />,
      description: 'Request has been approved'
    },
    {
      status: 'Rejected',
      icon: <XCircle className="h-4 w-4 text-red-600" />,
      description: 'Request has been rejected'
    }
  ]

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <HelpCircle className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">HR Management System Help</h1>
        </div>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Get help with all features of the HR management system including attendance, tasks, leave management, payroll, and more.
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search help topics..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="faq" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="faq">FAQ</TabsTrigger>
          <TabsTrigger value="quick-actions">Quick Actions</TabsTrigger>
          <TabsTrigger value="status-guide">Status Guide</TabsTrigger>
          <TabsTrigger value="troubleshooting">Troubleshooting</TabsTrigger>
        </TabsList>

        {/* FAQ Tab */}
        <TabsContent value="faq" className="space-y-6">
          {filteredFAQs.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-gray-500">No results found for "{searchTerm}"</p>
                <Button 
                  variant="outline" 
                  onClick={() => setSearchTerm('')}
                  className="mt-4"
                >
                  Clear Search
                </Button>
              </CardContent>
            </Card>
          ) : (
            filteredFAQs.map((category, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-900">
                    <div className="text-blue-600">{category.icon}</div>
                    {category.category}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {category.questions.map((faq, faqIndex) => (
                    <div key={faqIndex} className="border-l-4 border-blue-200 pl-4 py-2">
                      <h4 className="font-medium text-gray-900 mb-2">{faq.question}</h4>
                      <p className="text-gray-600 mb-3">{faq.answer}</p>
                      <div className="flex flex-wrap gap-1">
                        {faq.tags.map((tag, tagIndex) => (
                          <Badge key={tagIndex} variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Quick Actions Tab */}
        <TabsContent value="quick-actions" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quickActions.map((action, index) => (
              <Card key={index} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <div className="text-blue-600">{action.icon}</div>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium mb-2">{action.title}</h3>
                      <p className="text-sm text-gray-600 mb-3">{action.description}</p>
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                        {action.action}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Status Guide Tab */}
        <TabsContent value="status-guide" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment Status Indicators</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {statusIndicators.map((indicator, index) => (
                <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                  {indicator.icon}
                  <div>
                    <h4 className="font-medium">{indicator.status}</h4>
                    <p className="text-sm text-gray-600">{indicator.description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>User Roles & Permissions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium mb-2">Admin Role:</h4>
                  <div className="text-sm text-gray-600">
                    Full system access including employee management, payroll processing, system settings, and all reports.
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Manager Role:</h4>
                  <div className="text-sm text-gray-600">
                    Team management, task assignment, leave approval, payroll processing, and team reports.
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Employee Role:</h4>
                  <div className="text-sm text-gray-600">
                    Personal features including attendance, task management, leave requests, and payslip viewing.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Troubleshooting Tab */}
        <TabsContent value="troubleshooting" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  Common Issues
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <h4 className="font-medium">Login Problems</h4>
                  <p className="text-sm text-gray-600">
                    Check your email and password. Use "Forgot Password" or contact your administrator for account reset.
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Missing Features</h4>
                  <p className="text-sm text-gray-600">
                    Your role determines feature access. Contact your administrator if you need additional permissions.
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Data Not Saving</h4>
                  <p className="text-sm text-gray-600">
                    Check your internet connection and try again. Contact support if problems persist.
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Slow Performance</h4>
                  <p className="text-sm text-gray-600">
                    Try refreshing the page, clearing browser cache, or checking your internet connection.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Solutions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <h4 className="font-medium">Clear Browser Cache</h4>
                  <p className="text-sm text-gray-600">
                    Clear your browser cache and cookies, then refresh the page to resolve loading issues.
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Check Internet Connection</h4>
                  <p className="text-sm text-gray-600">
                    Ensure you have a stable internet connection for proper data synchronization.
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Contact Support</h4>
                  <p className="text-sm text-gray-600">
                    If issues persist, contact support with specific error messages and steps to reproduce the problem.
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Update Browser</h4>
                  <p className="text-sm text-gray-600">
                    Ensure you're using a modern browser (Chrome, Firefox, Safari, Edge) with the latest updates.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Contact Support */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6 text-center">
          <h3 className="font-medium mb-2">Still need help?</h3>
          <p className="text-sm text-gray-600 mb-4">
            If you can't find the answer you're looking for, contact your system administrator.
          </p>
          <Button variant="outline" asChild>
            <Link href="/support">Contact Support</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
