import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (authResult.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      message: 'Environment variables debug',
      env: {
        PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY
          ? process.env.PAYSTACK_SECRET_KEY.substring(0, 8) + '...'
          : 'NOT SET',
        PAYSTACK_PUBLIC_KEY: process.env.PAYSTACK_PUBLIC_KEY
          ? process.env.PAYSTACK_PUBLIC_KEY.substring(0, 8) + '...'
          : 'NOT SET',
        NODE_ENV: process.env.NODE_ENV,
        hasSecretKey: !!process.env.PAYSTACK_SECRET_KEY,
        hasPublicKey: !!process.env.PAYSTACK_PUBLIC_KEY,
        secretKeyLength: process.env.PAYSTACK_SECRET_KEY?.length || 0,
        publicKeyLength: process.env.PAYSTACK_PUBLIC_KEY?.length || 0,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
