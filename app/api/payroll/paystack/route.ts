import { NextRequest, NextResponse } from 'next/server'
import { genericPaymentService, GenericPayrollItem } from '@/lib/generic-payment-service'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/api-auth'
import { getBiweeklyPeriodForDate, periodStartDateString, periodEndDateString } from '@/lib/pay-periods'

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['admin'])
  if (auth.error) return auth.error

  try {
    const payrollItems: GenericPayrollItem[] = await request.json()
    
    // Validate the request
    if (!Array.isArray(payrollItems) || payrollItems.length === 0) {
      return NextResponse.json(
        { error: 'Invalid payroll items provided' },
        { status: 400 }
      )
    }

    // Validate each payroll item
    for (const item of payrollItems) {
      if (!item.employeeId || !item.employeeName || !item.netSalary) {
        return NextResponse.json(
          { error: 'Missing required fields in payroll item' },
          { status: 400 }
        )
      }

      if (!item.mobileNumber && !item.bankAccount) {
        return NextResponse.json(
          { error: 'Either mobile number or bank account must be provided' },
          { status: 400 }
        )
      }
    }

    // Process payments using the configured provider
    const results = await genericPaymentService.processPayrollPayment(payrollItems)

    // Persist payment metadata to payroll_entries (best-effort)
    try {
      const currentPeriod = getBiweeklyPeriodForDate(new Date())
      const periodStart = periodStartDateString(currentPeriod)
      const periodEnd = periodEndDateString(currentPeriod)

      const itemByEmployeeId = new Map<string, GenericPayrollItem>()
      for (const item of payrollItems) {
        itemByEmployeeId.set(item.employeeId, item)
      }

      for (const result of results) {
        const original = itemByEmployeeId.get(result.employeeId)
        const provider = result.provider
        const payment = {
          provider,
          status: result.status,
          reference: result.reference || null,
          transactionId: result.transactionId || null,
          error: result.error || null,
          currency: original?.currency || 'NGN',
          employeeName: original?.employeeName || '',
          updatedAt: new Date().toISOString()
        }

        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .or(`id.eq.${result.employeeId},auth_user_id.eq.${result.employeeId}`)
          .maybeSingle()
        if (!profile) continue

        const { data: existingRows } = await supabaseAdmin
          .from('payroll_entries')
          .select('id, payment')
          .eq('employee_id', profile.id)
          .eq('period_start_date', periodStart)
          .eq('period_end_date', periodEnd)
          .order('updated_at', { ascending: false })
          .limit(1)

        const nextStatus = result.status === 'success' ? 'paid' : result.status === 'pending' ? 'processed' : 'cancelled'
        const paymentDate = result.status === 'success' ? new Date().toISOString() : null

        if (existingRows && existingRows.length > 0) {
          await supabaseAdmin
            .from('payroll_entries')
            .update({
              status: nextStatus,
              ...(paymentDate ? { payment_date: paymentDate } : {}),
              payment: {
                ...((existingRows[0].payment || {}) as Record<string, unknown>),
                ...payment
              }
            })
            .eq('id', existingRows[0].id)
        } else {
          await supabaseAdmin.from('payroll_entries').insert({
            employee_id: profile.id,
            period_start_date: periodStart,
            period_end_date: periodEnd,
            pay_frequency: 'biweekly',
            net_salary: original?.netSalary || 0,
            status: nextStatus,
            ...(paymentDate ? { payment_date: paymentDate } : {}),
            payment
          })
        }
      }
    } catch (persistError) {
      console.warn('Failed to persist payment metadata to payroll_entries:', persistError)
    }
    
    // Check if all payments were successful
    const successCount = results.filter(result => result.status === 'success').length
    const errorCount = results.filter(result => result.status === 'error').length
    const pendingCount = results.filter(result => result.status === 'pending').length
    
    const response = {
      total: results.length,
      successful: successCount,
      failed: errorCount,
      pending: pendingCount,
      results: results
    }

    // Return appropriate status code
    if (errorCount === 0 && pendingCount === 0) {
      return NextResponse.json(response, { status: 200 })
    } else if (successCount === 0 && pendingCount === 0) {
      return NextResponse.json(response, { status: 400 })
    } else {
      return NextResponse.json(response, { status: 207 }) // Multi-status
    }

  } catch (error) {
    console.error('Payroll payment API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET endpoint to check account balance
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['admin'])
  if (auth.error) return auth.error

  try {
    const balance = await genericPaymentService.getAccountBalance()
    
    return NextResponse.json({
      balance: balance,
      message: 'Account balance retrieved successfully'
    })
  } catch (error) {
    console.error('Error fetching account balance:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch account balance',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 