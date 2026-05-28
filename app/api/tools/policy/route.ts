import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { SettingsService } from '@/lib/settings'

const DEFAULT_POLICY = {
  totalWorkHours: 8,
  allowedBreakMinutes: 60,
  screenshotIntervalMinutes: 5,
}

function mapPolicyFromSettings(settings: Awaited<ReturnType<SettingsService['getSettings']>>) {
  const productivity = settings.productivity
  return {
    totalWorkHours: productivity.targetProductiveHours ?? DEFAULT_POLICY.totalWorkHours,
    allowedBreakMinutes:
      productivity.allowedBreakMinutes ?? DEFAULT_POLICY.allowedBreakMinutes,
    screenshotIntervalMinutes: Math.max(
      1,
      productivity.screenshotIntervalMinutes ??
        productivity.idleThreshold ??
        DEFAULT_POLICY.screenshotIntervalMinutes
    ),
  }
}

export async function GET(request: Request) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let policy = { ...DEFAULT_POLICY }

    try {
      const settings = await SettingsService.getInstance().getSettings()
      policy = mapPolicyFromSettings(settings)
    } catch (error) {
      console.warn('Using default tools policy:', error)
    }

    return NextResponse.json({ success: true, policy })
  } catch (error) {
    console.error('Tools policy error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (authResult.user.role !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const totalWorkHours = Number(body.totalWorkHours)
    const allowedBreakMinutes = Number(body.allowedBreakMinutes)
    const screenshotIntervalMinutes = Number(body.screenshotIntervalMinutes)

    if (
      !Number.isFinite(totalWorkHours) ||
      !Number.isFinite(allowedBreakMinutes) ||
      !Number.isFinite(screenshotIntervalMinutes)
    ) {
      return NextResponse.json({ error: 'Invalid policy values' }, { status: 400 })
    }

    const settingsService = SettingsService.getInstance()
    const current = await settingsService.getSettings()

    await settingsService.updateSettings({
      productivity: {
        ...current.productivity,
        targetProductiveHours: totalWorkHours,
        allowedBreakMinutes,
        screenshotIntervalMinutes,
        idleThreshold: screenshotIntervalMinutes,
      },
    })

    const policy = {
      totalWorkHours,
      allowedBreakMinutes,
      screenshotIntervalMinutes,
    }

    return NextResponse.json({ success: true, policy })
  } catch (error) {
    console.error('Tools policy update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
