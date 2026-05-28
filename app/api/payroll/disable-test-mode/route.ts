import { NextRequest, NextResponse } from 'next/server'
import { settingsService } from '@/lib/settings'
import { requireRole } from '@/lib/api-auth'

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['admin'])
  if (auth.error) return auth.error

  try {
    void request
    const currentSettings = await settingsService.getSettings()
    
    // Update the test mode setting to false
    const updatedSettings = {
      ...currentSettings,
      paymentFacilitator: {
        ...currentSettings.paymentFacilitator,
        defaultSettings: {
          ...currentSettings.paymentFacilitator?.defaultSettings,
          testMode: false
        }
      }
    }
    
    // Save to database
    await settingsService.updateSettings(updatedSettings)
    
    return NextResponse.json({
      success: true,
      message: 'Test mode disabled successfully',
      settings: {
        testMode: false,
        paymentFacilitator: updatedSettings.paymentFacilitator
      }
    })
    
  } catch (error) {
    console.error('Error disabling test mode:', error)
    return NextResponse.json(
      { 
        error: 'Failed to disable test mode',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['admin'])
  if (auth.error) return auth.error

  try {
    void request
    const currentSettings = await settingsService.getSettings()
    
    return NextResponse.json({
      success: true,
      currentTestMode: currentSettings.paymentFacilitator?.defaultSettings?.testMode || false,
      settings: currentSettings.paymentFacilitator
    })
    
  } catch (error) {
    console.error('Error getting test mode status:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get test mode status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

