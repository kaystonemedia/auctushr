'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { 
  Mail, 
  Phone, 
  MessageSquare, 
  Clock, 
  CheckCircle,
  AlertCircle,
  User,
  FileText,
  Send,
  ArrowLeft,
  HelpCircle
} from 'lucide-react'
import Link from 'next/link'

export default function SupportPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    category: '',
    priority: '',
    description: '',
    attachments: [] as File[]
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const categories = [
    { value: 'payroll', label: 'Payroll Processing', icon: '💰' },
    { value: 'payments', label: 'Payment Issues', icon: '💳' },
    { value: 'employee', label: 'Employee Management', icon: '👥' },
    { value: 'technical', label: 'Technical Issues', icon: '🔧' },
    { value: 'account', label: 'Account Settings', icon: '⚙️' },
    { value: 'billing', label: 'Billing & Subscriptions', icon: '📊' },
    { value: 'other', label: 'Other', icon: '❓' }
  ]

  const priorities = [
    { value: 'low', label: 'Low', color: 'bg-green-100 text-green-800' },
    { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800' },
    { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-800' }
  ]

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError(null)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setFormData(prev => ({ ...prev, attachments: [...prev.attachments, ...files] }))
  }

  const removeAttachment = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      // Validate form
      if (!formData.name || !formData.email || !formData.subject || !formData.category || !formData.description) {
        throw new Error('Please fill in all required fields')
      }

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))

      // For now, just show success message
      setIsSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while submitting your request')
    } finally {
      setIsSubmitting(false)
    }
  }

  const supportMethods = [
    {
      title: 'Email Support',
      description: 'Get detailed help via email',
      icon: <Mail className="h-6 w-6" />,
      contact: 'support@yourcompany.com',
      responseTime: 'Within 24 hours',
      color: 'bg-blue-50 border-blue-200'
    },
    {
      title: 'Phone Support',
      description: 'Speak directly with our team',
      icon: <Phone className="h-6 w-6" />,
      contact: '+1 (555) 123-4567',
      responseTime: 'Mon-Fri 9AM-6PM',
      color: 'bg-green-50 border-green-200'
    },
    {
      title: 'Live Chat',
      description: 'Get instant help online',
      icon: <MessageSquare className="h-6 w-6" />,
      contact: 'Available on dashboard',
      responseTime: 'Immediate',
      color: 'bg-purple-50 border-purple-200'
    }
  ]

  if (isSubmitted) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Card className="text-center">
          <CardContent className="pt-6">
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Support Request Submitted!</h1>
            <p className="text-gray-600 mb-6">
              Thank you for contacting us. We've received your support request and will get back to you soon.
            </p>
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">What happens next?</h3>
                <ul className="text-sm text-blue-800 space-y-1 text-left">
                  <li>• You'll receive a confirmation email</li>
                  <li>• Our team will review your request</li>
                  <li>• We'll respond within the timeframe shown</li>
                  <li>• You can track your request status</li>
                </ul>
              </div>
              <div className="flex gap-3 justify-center">
                <Button asChild>
                  <Link href="/help">Back to Help</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/dashboard">Go to Dashboard</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/help" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Help
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <MessageSquare className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Contact Support</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Support Methods */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-blue-600" />
                Support Options
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {supportMethods.map((method, index) => (
                <div key={index} className={`p-4 border rounded-lg ${method.color}`}>
                  <div className="flex items-start gap-3">
                    <div className="text-blue-600">{method.icon}</div>
                    <div className="flex-1">
                      <h3 className="font-medium mb-1">{method.title}</h3>
                      <p className="text-sm text-gray-600 mb-2">{method.description}</p>
                      <div className="text-sm">
                        <div className="font-medium">{method.contact}</div>
                        <div className="text-gray-500">{method.responseTime}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Tips</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <span>Check the Help page first for common solutions</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <span>Include error messages and screenshots</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <span>Describe what you were trying to do</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <span>Mention your browser and device type</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Support Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Submit Support Request
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <span className="text-red-800">{error}</span>
                    </div>
                  </div>
                )}

                {/* Personal Information */}
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900">Personal Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name *
                      </label>
                      <Input
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        placeholder="Enter your full name"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address *
                      </label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        placeholder="Enter your email"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Request Details */}
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900">Request Details</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Subject *
                    </label>
                    <Input
                      value={formData.subject}
                      onChange={(e) => handleInputChange('subject', e.target.value)}
                      placeholder="Brief description of your issue"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Category *
                      </label>
                      <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.value} value={category.value}>
                              <div className="flex items-center gap-2">
                                <span>{category.icon}</span>
                                {category.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Priority
                      </label>
                      <Select value={formData.priority} onValueChange={(value) => handleInputChange('priority', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          {priorities.map((priority) => (
                            <SelectItem key={priority.value} value={priority.value}>
                              <div className="flex items-center gap-2">
                                <Badge className={priority.color}>
                                  {priority.label}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description *
                    </label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      placeholder="Please provide detailed information about your issue, including steps to reproduce it if applicable..."
                      rows={6}
                      required
                    />
                  </div>
                </div>

                {/* Attachments */}
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900">Attachments (Optional)</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Upload Files
                    </label>
                    <Input
                      type="file"
                      multiple
                      onChange={handleFileChange}
                      className="cursor-pointer"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      You can upload screenshots, error logs, or other relevant files (max 10MB each)
                    </p>
                  </div>

                  {formData.attachments.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-700">Attached Files:</h4>
                      {formData.attachments.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                          <span className="text-sm text-gray-700">{file.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAttachment(index)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <div className="flex justify-end">
                  <Button type="submit" disabled={isSubmitting} className="min-w-32">
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Submitting...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Send className="h-4 w-4" />
                        Submit Request
                      </div>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}





