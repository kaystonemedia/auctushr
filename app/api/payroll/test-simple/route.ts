import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['admin'])
  if (auth.error) return auth.error

  try {
    console.log('=== Simple Paystack Test ===')
    
    // Test 1: Check environment variables
    const envCheck = {
      hasSecretKey: !!process.env.PAYSTACK_SECRET_KEY,
      hasPublicKey: !!process.env.PAYSTACK_PUBLIC_KEY,
      secretKeyPrefix: process.env.PAYSTACK_SECRET_KEY ? 
        process.env.PAYSTACK_SECRET_KEY.substring(0, 8) + '...' : 'NOT SET',
      publicKeyPrefix: process.env.PAYSTACK_PUBLIC_KEY ? 
        process.env.PAYSTACK_PUBLIC_KEY.substring(0, 8) + '...' : 'NOT SET'
    }
    
    console.log('Environment check:', envCheck)
    
    // Test 2: Try to import settings service
    let settingsService = null
    try {
      const { SettingsService } = await import('@/lib/settings')
      settingsService = SettingsService.getInstance()
      console.log('Settings service imported successfully')
    } catch (importError) {
      console.error('Error importing settings service:', importError)
      return NextResponse.json({
        success: false,
        error: 'Failed to import settings service',
        details: importError instanceof Error ? importError.message : 'Unknown error',
        envCheck
      }, { status: 500 })
    }
    
    // Test 3: Try to get settings
    let settings = null
    try {
      settings = await settingsService.getSettings()
      console.log('Settings retrieved successfully')
    } catch (settingsError) {
      console.error('Error getting settings:', settingsError)
      return NextResponse.json({
        success: false,
        error: 'Failed to get settings',
        details: settingsError instanceof Error ? settingsError.message : 'Unknown error',
        envCheck
      }, { status: 500 })
    }
    
    // Test 4: Check Paystack configuration
    const paystackConfig = settings.paymentFacilitator.providers.paystack
    const configCheck = {
      enabled: paystackConfig.enabled,
      hasSecretKey: !!paystackConfig.credentials.secretKey,
      secretKeyPrefix: paystackConfig.credentials.secretKey ? 
        paystackConfig.credentials.secretKey.substring(0, 8) + '...' : 'NOT SET',
      hasPublicKey: !!paystackConfig.credentials.publicKey,
      defaultCurrency: paystackConfig.settings.defaultCurrency,
      testMode: paystackConfig.settings.testMode,
      activeProvider: settings.paymentFacilitator.activeProvider
    }
    
    console.log('Paystack config check:', configCheck)
    
    return NextResponse.json({
      success: true,
      message: 'Simple Paystack test completed',
      envCheck,
      configCheck,
      settings: {
        activeProvider: settings.paymentFacilitator.activeProvider,
        paystack: configCheck
      }
    })

  } catch (error) {
    console.error('Simple Paystack test error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}