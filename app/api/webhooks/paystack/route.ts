import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'

type TransferWebhookData = {
  reference?: string
  transfer_code?: string
  failure_reason?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-paystack-signature')
    
    if (!signature) {
      console.error('Missing Paystack signature')
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    // Verify webhook signature
    const secret = process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY
    if (!secret) {
      console.error('Paystack webhook secret not configured')
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    }

    const hash = crypto.createHmac('sha512', secret).update(body).digest('hex')
    
    if (hash !== signature) {
      console.error('Invalid Paystack signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const event = JSON.parse(body)
    console.log('Paystack webhook received:', event.type, event.data)

    // Handle different event types
    switch (event.type) {
      case 'transfer.success':
        await handleTransferSuccess(event.data)
        break
      case 'transfer.failed':
        await handleTransferFailed(event.data)
        break
      case 'transfer.reversed':
        await handleTransferReversed(event.data)
        break
      default:
        console.log('Unhandled webhook event type:', event.type)
    }

    return NextResponse.json({ received: true })

  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

async function updatePayrollByReference(reference: string, update: Record<string, unknown>) {
  const { data, error } = await supabaseAdmin
    .from('payroll_entries')
    .select('id, payment')
    .contains('payment', { reference })
    .order('updated_at', { ascending: false })
    .limit(1)

  if (error) {
    throw error
  }

  if (!data || data.length === 0) {
    console.error('No payroll entry found for transfer reference:', reference)
    return
  }

  const row = data[0]
  const existingPayment = (row.payment || {}) as Record<string, unknown>
  const { error: updateError } = await supabaseAdmin
    .from('payroll_entries')
    .update({
      ...update,
      payment: {
        ...existingPayment,
        ...((update.payment as Record<string, unknown>) || {})
      }
    })
    .eq('id', row.id)

  if (updateError) {
    throw updateError
  }
}

async function handleTransferSuccess(transferData: TransferWebhookData) {
  try {
    const reference = transferData.reference
    if (!reference) {
      console.error('Missing transfer reference for success event')
      return
    }

    await updatePayrollByReference(reference, {
      status: 'paid',
      payment_date: new Date().toISOString(),
      payment: {
        status: 'success',
        transactionId: transferData.transfer_code,
        completedAt: new Date().toISOString(),
        provider: 'paystack'
      }
    })

    console.log('Updated payroll entry for successful transfer:', reference)

  } catch (error) {
    console.error('Error handling transfer success:', error)
  }
}

async function handleTransferFailed(transferData: TransferWebhookData) {
  try {
    const reference = transferData.reference
    if (!reference) {
      console.error('Missing transfer reference for failed event')
      return
    }

    await updatePayrollByReference(reference, {
      status: 'cancelled',
      payment: {
        status: 'failed',
        error: transferData.failure_reason || 'Transfer failed',
        failedAt: new Date().toISOString(),
        provider: 'paystack'
      }
    })

    console.log('Updated payroll entry for failed transfer:', reference)

  } catch (error) {
    console.error('Error handling transfer failure:', error)
  }
}

async function handleTransferReversed(transferData: TransferWebhookData) {
  try {
    const reference = transferData.reference
    if (!reference) {
      console.error('Missing transfer reference for reversed event')
      return
    }

    await updatePayrollByReference(reference, {
      status: 'cancelled',
      payment: {
        status: 'reversed',
        reversedAt: new Date().toISOString(),
        provider: 'paystack'
      }
    })

    console.log('Updated payroll entry for reversed transfer:', reference)

  } catch (error) {
    console.error('Error handling transfer reversal:', error)
  }
}