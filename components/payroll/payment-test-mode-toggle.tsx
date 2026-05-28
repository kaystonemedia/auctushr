'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { settingsClientService } from '@/lib/settings-client'
import { AlertTriangle, CheckCircle, TestTube, CreditCard } from 'lucide-react'

export function PaymentTestModeToggle() {
  const [testMode, setTestMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await settingsClientService.getSettings()
        setTestMode(settings.paymentFacilitator?.defaultSettings?.testMode || false)
      } catch (error) {
        console.error('Error loading settings:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [])

  const handleToggleTestMode = async (enabled: boolean) => {
    try {
      setSaving(true)
      
      // Update settings
      const settings = await settingsClientService.getSettings()
      const updatedSettings = {
        ...settings,
        paymentFacilitator: {
          ...settings.paymentFacilitator,
          defaultSettings: {
            ...settings.paymentFacilitator.defaultSettings,
            testMode: enabled
          }
        }
      }

      await settingsClientService.updateSettings(updatedSettings)
      setTestMode(enabled)
      
      // Show success message
      console.log(`Test mode ${enabled ? 'enabled' : 'disabled'}`)
      
    } catch (error) {
      console.error('Error updating test mode:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="ml-2">Loading settings...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-orange-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {testMode ? (
            <>
              <TestTube className="h-5 w-5 text-orange-600" />
              Test Mode Active
            </>
          ) : (
            <>
              <CreditCard className="h-5 w-5 text-green-600" />
              Live Mode Active
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Payment Processing Mode</p>
            <p className="text-sm text-gray-600">
              {testMode 
                ? 'Simulating payments without real money transfers' 
                : 'Processing real payments with actual money transfers'
              }
            </p>
          </div>
          <Switch
            checked={testMode}
            onCheckedChange={handleToggleTestMode}
            disabled={saving}
          />
        </div>

        {testMode ? (
          <Alert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <strong>Test Mode:</strong> All payments will be simulated. No real money will be transferred. 
              Perfect for testing your payroll system without funding your Paystack account.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <strong>Live Mode:</strong> Real payments will be processed. Ensure your Paystack account is funded 
              and transfers are enabled before processing payroll.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-2">
          <Badge variant={testMode ? "secondary" : "default"}>
            {testMode ? 'TEST MODE' : 'LIVE MODE'}
          </Badge>
          {saving && (
            <Badge variant="outline">
              Saving...
            </Badge>
          )}
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p><strong>Test Mode Benefits:</strong></p>
          <ul className="list-disc list-inside ml-2 space-y-1">
            <li>No real money required</li>
            <li>Test all payroll features safely</li>
            <li>Simulate payment success/failure scenarios</li>
            <li>Perfect for development and testing</li>
          </ul>
          
          <p className="mt-2"><strong>Live Mode Requirements:</strong></p>
          <ul className="list-disc list-inside ml-2 space-y-1">
            <li>Funded Paystack account balance</li>
            <li>Verified account (KYC completed)</li>
            <li>Transfers enabled in dashboard</li>
            <li>Real money will be transferred</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}





