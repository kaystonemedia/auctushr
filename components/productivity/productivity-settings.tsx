import { useState, useEffect } from 'react'
import { useNewAuth } from '@/contexts/new-auth-context'
import { ProductivityService } from '@/lib/productivity'
import { ProductivitySettings } from '@/types/productivity'
import { settingsService } from '@/lib/settings'
import { Settings } from '@/types/settings'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { toast } from 'sonner'
import { Settings as SettingsIcon, Bell, Clock, Target, AlertCircle } from 'lucide-react'

export function ProductivitySettingsComponent() {
  const { user } = useNewAuth()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user) {
      fetchSettings()
    }
  }, [user])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const currentSettings = await settingsService.getSettings()
      setSettings(currentSettings)
    } catch (error) {
      console.error('Error fetching settings:', error)
      toast.error('Failed to fetch settings')
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    if (!user || !settings) return

    try {
      setSaving(true)
      await settingsService.updateSettings(settings)
      toast.success('Settings saved successfully')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const updateProductivitySettings = (updates: Partial<Settings['productivity']>) => {
    if (!settings) return
    setSettings({
      ...settings,
      productivity: { ...settings.productivity, ...updates }
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p>Failed to load settings</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <SettingsIcon className="mr-2 h-5 w-5" />
            Productivity Settings
          </CardTitle>
          <CardDescription>
            Customize your productivity tracking preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center">
              <Target className="mr-2 h-5 w-5" />
              Basic Settings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={settings.productivity.trackingEnabled}
                  onCheckedChange={(checked) => updateProductivitySettings({ trackingEnabled: checked })}
                />
                <Label>Enable Productivity Tracking</Label>
              </div>
              <div>
                <Label htmlFor="idleThreshold">Idle Threshold (minutes)</Label>
                <Input
                  id="idleThreshold"
                  type="number"
                  value={settings.productivity.idleThreshold}
                  onChange={(e) => updateProductivitySettings({ idleThreshold: Number(e.target.value) })}
                  placeholder="15"
                />
              </div>
            </div>
          </div>

          {/* Focus Sessions */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Focus Session Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="focusSessionDuration">Focus Session Duration (minutes)</Label>
                <Input
                  id="focusSessionDuration"
                  type="number"
                  value={settings.productivity.focusSessionDuration}
                  onChange={(e) => updateProductivitySettings({ focusSessionDuration: Number(e.target.value) })}
                  placeholder="25"
                />
              </div>
              <div>
                <Label htmlFor="targetProductiveHours">Target Productive Hours</Label>
                <Input
                  id="targetProductiveHours"
                  type="number"
                  value={settings.productivity.targetProductiveHours}
                  onChange={(e) => updateProductivitySettings({ targetProductiveHours: Number(e.target.value) })}
                  placeholder="6"
                />
              </div>
            </div>
          </div>

          {/* Domain Lists */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Domain Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="productiveDomains">Productive Domains (comma-separated)</Label>
                <Input
                  id="productiveDomains"
                  value={settings.productivity.productiveDomains.join(', ')}
                  onChange={(e) => updateProductivitySettings({ 
                    productiveDomains: e.target.value.split(',').map(d => d.trim()).filter(d => d)
                  })}
                  placeholder="github.com, stackoverflow.com, docs.google.com"
                />
              </div>
              <div>
                <Label htmlFor="unproductiveSites">Unproductive Sites (comma-separated)</Label>
                <Input
                  id="unproductiveSites"
                  value={settings.productivity.unproductiveSites.join(', ')}
                  onChange={(e) => updateProductivitySettings({ 
                    unproductiveSites: e.target.value.split(',').map(d => d.trim()).filter(d => d)
                  })}
                  placeholder="facebook.com, twitter.com, youtube.com"
                />
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={saveSettings} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
} 