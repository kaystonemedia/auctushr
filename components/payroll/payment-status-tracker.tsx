'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { formatCurrency } from '@/lib/utils'
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  RefreshCw, 
  AlertTriangle,
  DollarSign,
  Calendar,
  User
} from 'lucide-react'

interface PaymentStatus {
  id: string
  employeeId: string
  employeeName: string
  department: string
  amount: number
  currency: string
  status: 'pending' | 'success' | 'failed' | 'reversed'
  provider: string
  reference?: string
  transactionId?: string
  error?: string
  processedAt: string
  completedAt?: string
  failedAt?: string
  reversedAt?: string
}

interface PaymentStatusTrackerProps {
  period?: string
  limit?: number
}

export function PaymentStatusTracker({ period, limit: limitCount = 50 }: PaymentStatusTrackerProps) {
  const [payments, setPayments] = useState<PaymentStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadPaymentStatus = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({ hasPayment: 'true' })
      if (period) params.set('periodMonth', period)

      const res = await fetch(`/api/payroll/entries?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load payments')
      const data = await res.json()

      const paymentData: PaymentStatus[] = (data.entries || [])
        .slice(0, limitCount)
        .map((entry: {
          id: string
          employeeId: string
          employeeName: string
          department: string
          netSalary: number
          payment: Record<string, unknown>
          processedAt?: string
          updatedAt?: string
        }) => {
          const payment = entry.payment || {}
          return {
            id: entry.id,
            employeeId: entry.employeeId,
            employeeName: entry.employeeName,
            department: entry.department,
            amount: entry.netSalary || 0,
            currency: (payment.currency as string) || 'GHS',
            status: (payment.status as PaymentStatus['status']) || 'pending',
            provider: (payment.provider as string) || 'unknown',
            reference: payment.reference as string | undefined,
            transactionId: payment.transactionId as string | undefined,
            error: payment.error as string | undefined,
            processedAt: (entry.processedAt || entry.updatedAt || '') as string,
            completedAt: payment.completedAt as string | undefined,
            failedAt: payment.failedAt as string | undefined,
            reversedAt: payment.reversedAt as string | undefined,
          }
        })

      setPayments(paymentData)
    } catch (err) {
      console.error('Error loading payment status:', err)
      setError('Failed to load payment status. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPaymentStatus()
  }, [period, limitCount])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadPaymentStatus()
    setRefreshing(false)
  }

  const handleRetryPayment = async (payment: PaymentStatus) => {
    try {
      setRefreshing(true)
      
      const response = await fetch('/api/payroll/retry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId: payment.employeeId,
          reference: payment.reference
        })
      })

      if (!response.ok) {
        throw new Error('Failed to retry payment')
      }

      const result = await response.json()
      console.log('Retry result:', result)
      
      // Refresh the payment status
      await loadPaymentStatus()
      
    } catch (error) {
      console.error('Error retrying payment:', error)
      setError('Failed to retry payment. Please try again.')
    } finally {
      setRefreshing(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />
      case 'reversed':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-100 text-green-800">Success</Badge>
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>
      case 'reversed':
        return <Badge variant="outline" className="bg-orange-100 text-orange-800">Reversed</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const getStatusCounts = () => {
    const counts = {
      total: payments.length,
      success: payments.filter(p => p.status === 'success').length,
      failed: payments.filter(p => p.status === 'failed').length,
      pending: payments.filter(p => p.status === 'pending').length,
      reversed: payments.filter(p => p.status === 'reversed').length
    }
    return counts
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const statusCounts = getStatusCounts()

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            <span>Loading payment status...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-2xl font-bold">{statusCounts.total}</p>
              </div>
              <DollarSign className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Success</p>
                <p className="text-2xl font-bold text-green-600">{statusCounts.success}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{statusCounts.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Failed</p>
                <p className="text-2xl font-bold text-red-600">{statusCounts.failed}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600">Reversed</p>
                <p className="text-2xl font-bold text-orange-600">{statusCounts.reversed}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Payment Status</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md mb-4">
              {error}
            </div>
          )}

          {payments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No payment records found
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div key={payment.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(payment.status)}
                      <div>
                        <div className="font-medium">{payment.employeeName}</div>
                        <div className="text-sm text-gray-600">
                          <User className="h-3 w-3 inline mr-1" />
                          {payment.department}
                        </div>
                        <div className="text-xs text-gray-500">
                          <Calendar className="h-3 w-3 inline mr-1" />
                          {formatDate(payment.processedAt)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-medium">
                          {formatCurrency(payment.amount, payment.currency)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {payment.provider.toUpperCase()}
                        </div>
                        {payment.reference && (
                          <div className="text-xs text-gray-500">
                            Ref: {payment.reference.slice(0, 8)}...
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(payment.status)}
                        {payment.status === 'failed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRetryPayment(payment)}
                            disabled={refreshing}
                          >
                            <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {payment.error && (
                    <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-600">
                      Error: {payment.error}
                    </div>
                  )}
                  
                  {payment.status === 'success' && payment.completedAt && (
                    <div className="mt-2 text-xs text-green-600">
                      Completed: {formatDate(payment.completedAt)}
                    </div>
                  )}
                  
                  {payment.status === 'failed' && payment.failedAt && (
                    <div className="mt-2 text-xs text-red-600">
                      Failed: {formatDate(payment.failedAt)}
                    </div>
                  )}
                  
                  {payment.status === 'reversed' && payment.reversedAt && (
                    <div className="mt-2 text-xs text-orange-600">
                      Reversed: {formatDate(payment.reversedAt)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
