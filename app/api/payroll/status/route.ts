import { NextRequest, NextResponse } from 'next/server'
import { genericPaymentService } from '@/lib/generic-payment-service'
import { isFirebaseAdminInitialized, getAdminDb } from '@/lib/firebase-admin'

export async function GET(request: NextRequest) {
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
    if (isFirebaseAdminInitialized()) {
      const adminDb = getAdminDb()
      const q = adminDb
        .collection('payrollEntries')
        .where('paymentTransactionId', '==', transactionId)
        .orderBy('processedAt', 'desc')
        .limit(1)
      const snapshot = await q.get()
      if (!snapshot.empty) {
        const docRef = snapshot.docs[0].ref
        await docRef.update({
          paymentStatus: normalizedStatus,
          payment: {
            provider,
            status: normalizedStatus,
            transactionId,
            updatedAt: new Date().toISOString(),
            polled: true
          }
        })
      }
    }

    return NextResponse.json({ provider, transactionId, status: normalizedStatus, raw: statusData })
  } catch (error) {
    console.error('Payment status check error:', error)
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 })
  }
}



