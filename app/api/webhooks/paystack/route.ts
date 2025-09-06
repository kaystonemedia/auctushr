import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { isFirebaseAdminInitialized, getAdminDb } from '@/lib/firebase-admin'

// Verify Paystack signature
function verifySignature(rawBody: string, signature: string | null) {
  const secret = process.env.PAYSTACK_SECRET_KEY || ''
  if (!secret || !signature) return false
  const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex')
  return hash === signature
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('x-paystack-signature')

    if (!verifySignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const payload = JSON.parse(rawBody)
    const event: string = payload?.event
    const data = payload?.data || {}

    // We primarily expect transfer events for payouts
    if (!event || !isFirebaseAdminInitialized()) {
      return NextResponse.json({ ok: true })
    }

    const adminDb = getAdminDb()
    const transactionId = data?.transfer_code || data?.id || null
    const reference = data?.reference || null
    const status = data?.status || payload?.data?.status || 'pending'

    // Try to locate a payroll entry by transactionId or reference; fallback to recent entries for the employee if metadata exists
    let snapshot
    if (reference) {
      const q = (adminDb as any)
        .collection('payrollEntries')
        .where('paymentReference', '==', reference)
        .orderBy('processedAt', 'desc')
        .limit(1)
      snapshot = await q.get()
    }

    if ((!snapshot || snapshot.empty) && transactionId) {
      const q2 = (adminDb as any)
        .collection('payrollEntries')
        .where('paymentTransactionId', '==', transactionId)
        .orderBy('processedAt', 'desc')
        .limit(1)
      snapshot = await q2.get()
    }

    if (!snapshot || snapshot.empty) {
      // As a last resort, create a minimal record to retain the payment event
      await (adminDb as any).collection('payrollEntries').add({
        employeeId: data?.recipient?.details?.authorization?.receiver_bank_account_number || 'unknown',
        employeeName: data?.recipient?.name || '',
        netPay: data?.amount ? data.amount / 100 : 0,
        currency: data?.currency || 'NGN',
        month: String(new Date().getMonth() + 1),
        year: new Date().getFullYear(),
        processedAt: new Date().toISOString(),
        status,
        payment: {
          provider: 'paystack',
          status,
          reference,
          transactionId,
          updatedAt: new Date().toISOString(),
          webhook: true
        },
        paymentStatus: status,
        paymentProvider: 'paystack',
        paymentReference: reference,
        paymentTransactionId: transactionId
      })
      return NextResponse.json({ ok: true })
    }

    const docRef = snapshot.docs[0].ref
    await docRef.update({
      paymentStatus: status,
      paymentReference: reference,
      paymentTransactionId: transactionId,
      payment: {
        provider: 'paystack',
        status,
        reference,
        transactionId,
        updatedAt: new Date().toISOString(),
        webhook: true
      }
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Paystack webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ message: 'OK' })
}



