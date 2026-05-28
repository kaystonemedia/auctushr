import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  getTasksCompletedFromRow,
  toRecordDate,
  type ProductivityRecordRow,
} from '@/lib/productivity-records-helpers'

function getStartDateForPeriod(period: string): string {
  return toRecordDate(getPeriodStartDate(period))
}

function getPeriodStartDate(period: string): Date {
  const now = new Date()
  const start = new Date(now)
  switch (period) {
    case 'week':
      start.setDate(now.getDate() - 7)
      break
    case 'year':
      start.setFullYear(now.getFullYear() - 1)
      break
    case 'month':
    default:
      start.setMonth(now.getMonth() - 1)
      break
  }
  return start
}

function buildGamification(scores: ProductivityRecordRow[]) {
  const totalTasks = scores.reduce((sum, row) => sum + getTasksCompletedFromRow(row), 0)
  const averageScore =
    scores.length > 0
      ? scores.reduce((sum, row) => sum + Number(row.productivity_score || 0), 0) / scores.length
      : 0
  const streak = Math.min(scores.length, 30)
  const badges: string[] = []
  if (totalTasks >= 10) badges.push('task_starter')
  if (totalTasks >= 50) badges.push('task_master')
  if (averageScore >= 80) badges.push('high_performer')
  if (streak >= 7) badges.push('consistent')

  const achievements = [
    ...(totalTasks >= 1
      ? [{ id: 'first_task', name: 'First Task', description: 'Complete your first task' }]
      : []),
    ...(totalTasks >= 10
      ? [{ id: 'task_enthusiast', name: 'Task Enthusiast', description: 'Complete 10 tasks' }]
      : []),
    ...(averageScore >= 80
      ? [{ id: 'high_performer', name: 'High Performer', description: 'Maintain 80+ average score' }]
      : []),
  ]
  const totalExperience = Math.round(
    scores.reduce((sum, row) => sum + Number(row.productivity_score || 0) * 10, 0)
  )
  const level = Math.max(1, Math.floor(totalExperience / 1000) + 1)

  return { badges, achievements, streak, level, totalExperience }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || authResult.user.profileId
    if (userId !== authResult.user.profileId && !['admin', 'manager'].includes(authResult.user.role)) {
      return NextResponse.json({ error: 'Not authorized to view this data' }, { status: 403 })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .or(`id.eq.${userId},auth_user_id.eq.${userId}`)
      .maybeSingle()
    if (!profile) {
      return NextResponse.json({ badges: [], achievements: [], streak: 0, level: 1, totalExperience: 0 })
    }

    const { data: scores, error } = await supabaseAdmin
      .from('productivity_records')
      .select('productivity_score, metadata, date')
      .eq('user_id', profile.id)
      .order('date', { ascending: false })
      .limit(30)
    if (error) throw error

    return NextResponse.json(buildGamification((scores || []) as ProductivityRecordRow[]))
  } catch (error) {
    console.error('Error fetching gamification data:', error)
    return NextResponse.json({ error: 'Failed to fetch gamification data' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!['admin', 'manager'].includes(authResult.user.role)) {
      return NextResponse.json({ error: 'Not authorized to award badges' }, { status: 403 })
    }

    const body = await request.json()
    const { userId, badgeType, reason } = body
    if (!userId || !badgeType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .or(`id.eq.${userId},auth_user_id.eq.${userId}`)
      .maybeSingle()
    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const badge = {
      id: `${profile.id}_${badgeType}_${Date.now()}`,
      userId: profile.id,
      badgeType,
      reason: reason || 'Awarded by manager',
      awardedBy: authResult.user.profileId,
      awardedAt: new Date(),
      isActive: true,
    }

    await supabaseAdmin.from('notifications').insert({
      user_id: profile.id,
      type: 'badge_awarded',
      title: 'New Badge Earned!',
      message: `You've been awarded the ${badgeType} badge!`,
      data: { badgeType, reason: badge.reason },
      read: false,
      severity: 'info',
    })

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: authResult.user.profileId,
      action: 'badge.awarded',
      entity_type: 'profile',
      entity_id: profile.id,
      details: badge,
    })

    return NextResponse.json({ badge })
  } catch (error) {
    console.error('Error awarding badge:', error)
    return NextResponse.json({ error: 'Failed to award badge' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!['admin', 'manager'].includes(authResult.user.role)) {
      return NextResponse.json({ error: 'Not authorized to view leaderboard' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month'
    const department = searchParams.get('department')
    const startDate = getStartDateForPeriod(period)

    let profileQuery = supabaseAdmin.from('profiles').select('id, first_name, last_name, department')
    if (department) profileQuery = profileQuery.eq('department', department)
    const { data: profiles, error: profileError } = await profileQuery
    if (profileError) throw profileError

    const profileIds = (profiles || []).map((profile) => profile.id)
    if (profileIds.length === 0) {
      return NextResponse.json({ leaderboard: [] })
    }

    const { data: scores, error: scoreError } = await supabaseAdmin
      .from('productivity_records')
      .select('user_id, productivity_score, metadata')
      .in('user_id', profileIds)
      .gte('date', startDate)
    if (scoreError) throw scoreError

    const grouped = new Map<string, { totalScore: number; tasks: number; sample: number }>()
    for (const score of scores || []) {
      const row = score as ProductivityRecordRow
      const existing = grouped.get(row.user_id) || { totalScore: 0, tasks: 0, sample: 0 }
      existing.totalScore += Number(row.productivity_score || 0)
      existing.tasks += getTasksCompletedFromRow(row)
      existing.sample += 1
      grouped.set(row.user_id, existing)
    }

    const leaderboard = Array.from(grouped.entries())
      .map(([userId, row]) => {
        const profile = (profiles || []).find((item) => item.id === userId)
        const totalExperience = Math.round(row.totalScore * 10)
        return {
          userId,
          userName: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'User',
          totalExperience,
          averageScore: row.sample > 0 ? Math.round(row.totalScore / row.sample) : 0,
          streak: row.sample,
          badgeCount: row.tasks >= 50 ? 2 : row.tasks >= 10 ? 1 : 0,
          level: Math.max(1, Math.floor(totalExperience / 1000) + 1),
        }
      })
      .sort((a, b) => b.totalExperience - a.totalExperience)
      .slice(0, 20)

    return NextResponse.json({ leaderboard })
  } catch (error) {
    console.error('Error fetching leaderboard:', error)
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 })
  }
}
