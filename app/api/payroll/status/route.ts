import { NextRequest, NextResponse } from 'next/server'
import { genericPaymentService } from '@/lib/generic-payment-service'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['admin', 'manager'])
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const transactionId = searchParams.get('transactionId')
    const provider = searchParams.get('provider') || 'paystack'

    if (!transactionId) {
      return NextResponse.json({ error: 'transactionId is required' }, { status: 400 })
    }

    // Ask provider for latest status
    const statusData = await genericPaymentService.checkPaymentStatus(transactionId, provider)
    const normalizedStatus = (statusData?.status || statusData?.transfer_status || 'pending') as string

    // Update payroll entry if present
    const { data: rows, error: fetchError } = await supabaseAdmin
      .from('payroll_entries')
      .select('id, payment')
      .contains('payment', { transactionId })
      .order('updated_at', { ascending: false })
      .limit(1)

    if (fetchError) {
      throw fetchError
    }

    if (rows && rows.length > 0) {
      const currentPayment = (rows[0].payment || {}) as Record<string, unknown>
      const { error: updateError } = await supabaseAdmin
        .from('payroll_entries')
        .update({
          status: normalizedStatus === 'success' ? 'paid' : normalizedStatus === 'failed' ? 'cancelled' : 'processed',
          payment: {
            ...currentPayment,
            provider,
            status: normalizedStatus,
            transactionId,
            updatedAt: new Date().toISOString(),
            polled: true
          }
        })
        .eq('id', rows[0].id)

      if (updateError) {
        throw updateError
      }
    }

    return NextResponse.json({ provider, transactionId, status: normalizedStatus, raw: statusData })
  } catch (error) {
    console.error('Payment status check error:', error)
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 })
  }
}



