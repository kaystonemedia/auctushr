import { NextRequest, NextResponse } from 'next/server'
import { GenericPaymentService } from '@/lib/generic-payment-service'
import { requireRole } from '@/lib/api-auth'

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['admin'])
  if (auth.error) return auth.error

  try {
    // Test Paystack integration with a simple payroll item
    const testPayrollItem = {
      employeeId: 'test_001',
      employeeName: 'Test Employee',
      netSalary: 1000, // 1000 NGN (will be converted to kobo)
      currency: 'NGN',
      mobileNumber: '08012345678' // Test mobile number
    }

    console.log('Testing Paystack integration with:', testPayrollItem)

    // Create the payment service
    const paymentService = new GenericPaymentService()
    
    // Process the test payment
    const results = await paymentService.processPayrollPayment([testPayrollItem])
    
    console.log('Paystack test results:', results)

    return NextResponse.json({
      success: true,
      message: 'Paystack integration test completed',
      testData: testPayrollItem,
      results: results
    })

  } catch (error) {
    console.error('Paystack test error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['admin'])
  if (auth.error) return auth.error

  try {
    // Return current Paystack configuration status
    const { searchParams } = new URL(request.url)
    const testMode = searchParams.get('test') === 'true'
    void testMode

    const paymentService = new GenericPaymentService()
    
    // Get current settings
    const settings = await paymentService['settingsService'].getSettings()
    
    const paystackConfig = settings.paymentFacilitator.providers.paystack
    
    return NextResponse.json({
      success: true,
      message: 'Paystack configuration status',
      config: {
        enabled: paystackConfig.enabled,
        hasSecretKey: !!paystackConfig.credentials.secretKey,
        secretKeyPrefix: paystackConfig.credentials.secretKey ? 
          paystackConfig.credentials.secretKey.substring(0, 8) + '...' : 'NOT SET',
        hasPublicKey: !!paystackConfig.credentials.publicKey,
        defaultCurrency: paystackConfig.settings.defaultCurrency,
        testMode: paystackConfig.settings.testMode,
        activeProvider: settings.paymentFacilitator.activeProvider
      },
      environment: {
        hasSecretKeyEnv: !!process.env.PAYSTACK_SECRET_KEY,
        hasPublicKeyEnv: !!process.env.PAYSTACK_PUBLIC_KEY,
        secretKeyPrefix: process.env.PAYSTACK_SECRET_KEY ? 
          process.env.PAYSTACK_SECRET_KEY.substring(0, 8) + '...' : 'NOT SET'
      }
    })

  } catch (error) {
    console.error('Error getting Paystack config status:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}





















