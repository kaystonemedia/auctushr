import { NextRequest, NextResponse } from 'next/server'
import { genericPaymentService, GenericPayrollItem } from '@/lib/generic-payment-service'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/api-auth'

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['admin'])
  if (auth.error) return auth.error

  try {
    const { employeeId, reference } = await request.json()
    
    if (!employeeId || !reference) {
      return NextResponse.json(
        { error: 'Missing required fields: employeeId, reference' },
        { status: 400 }
      )
    }

    // Resolve employee profile id by profile id or auth uid
    const { data: employeeProfile, error: employeeError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .or(`id.eq.${employeeId},auth_user_id.eq.${employeeId}`)
      .maybeSingle()

    if (employeeError) {
      throw employeeError
    }

    if (!employeeProfile) {
      return NextResponse.json(
        { error: 'Employee profile not found' },
        { status: 404 }
      )
    }

    const { data: rows, error: fetchError } = await supabaseAdmin
      .from('payroll_entries')
      .select('*')
      .eq('employee_id', employeeProfile.id)
      .contains('payment', { reference })
      .order('updated_at', { ascending: false })
      .limit(1)

    if (fetchError) {
      throw fetchError
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: 'No payroll entry found for retry' },
        { status: 404 }
      )
    }

    const payrollEntry = rows[0]
    const payment = (payrollEntry.payment || {}) as Record<string, unknown>
    
    // Build payroll item for retry
    const payrollItem: GenericPayrollItem = {
      employeeId: employeeId,
      employeeName: (payment.employeeName as string) || 'Employee',
      netSalary: Number(payrollEntry.net_salary || 0),
      currency: (payment.currency as string) || 'GHS',
      ...(payment.mobileNumber
        ? { mobileNumber: payment.mobileNumber as string }
        : payment.bankAccount
        ? { bankAccount: payment.bankAccount as Record<string, string> }
        : { mobileNumber: '' })
    }

    // Update status to retrying
    const { error: retryFlagError } = await supabaseAdmin
      .from('payroll_entries')
      .update({
        payment: {
          ...payment,
          status: 'retrying',
          retryAttempts: Number((payment.retryAttempts as number) || 0) + 1,
          lastRetryAt: new Date().toISOString()
        }
      })
      .eq('id', payrollEntry.id)

    if (retryFlagError) {
      throw retryFlagError
    }

    // Retry the payment
    const results = await genericPaymentService.processPayrollPayment([payrollItem])
    
    if (results.length === 0) {
      throw new Error('No results returned from payment service')
    }

    const result = results[0]

    // Update payroll entry with retry result
    const { error: finalUpdateError } = await supabaseAdmin
      .from('payroll_entries')
      .update({
        status: result.status === 'success' ? 'paid' : 'cancelled',
        payment: {
          ...payment,
          status: result.status,
          transactionId: result.transactionId,
          reference: result.reference,
          error: result.error,
          retriedAt: new Date().toISOString()
        }
      })
      .eq('id', payrollEntry.id)

    if (finalUpdateError) {
      throw finalUpdateError
    }

    return NextResponse.json({
      success: true,
      result: result
    })

  } catch (error) {
    console.error('Retry payment error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to retry payment',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}





