import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  buildProductivityUpsert,
  mapProductivityRowToApi,
  toRecordDate,
  type ProductivityRecordRow,
} from '@/lib/productivity-records-helpers'

function getPeriodStart(period: string) {
  const now = new Date()
  const start = new Date(now)
  switch (period) {
    case 'day':
      start.setDate(now.getDate() - 1)
      break
    case 'month':
      start.setMonth(now.getMonth() - 1)
      break
    case 'year':
      start.setFullYear(now.getFullYear() - 1)
      break
    case 'week':
    default:
      start.setDate(now.getDate() - 7)
      break
  }
  return start
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || authResult.user.profileId
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const period = searchParams.get('period') || 'week'

    if (userId !== authResult.user.profileId && !['admin', 'manager'].includes(authResult.user.role)) {
      return NextResponse.json({ error: 'Not authorized to view this data' }, { status: 403 })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .or(`id.eq.${userId},auth_user_id.eq.${userId}`)
      .maybeSingle()
    if (!profile) {
      return NextResponse.json({ scores: [], stats: {}, period })
    }

    const start = startDate ? toRecordDate(startDate) : toRecordDate(getPeriodStart(period))
    const end = endDate ? toRecordDate(endDate) : toRecordDate(new Date())

    const { data: rows, error } = await supabaseAdmin
      .from('productivity_records')
      .select('*')
      .eq('user_id', profile.id)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false })
    if (error) throw error

    const scores = (rows || []).map((row) => mapProductivityRowToApi(row as ProductivityRecordRow))

    const averageScore =
      scores.length > 0
        ? Math.round(scores.reduce((sum, score) => sum + score.blendedScore, 0) / scores.length)
        : 0
    const totalTasks = scores.reduce((sum, score) => sum + score.taskCount, 0)
    const completedTasks = scores.reduce((sum, score) => sum + score.completedTasks, 0)
    const onTimeTasks = scores.reduce((sum, score) => sum + score.onTimeTasks, 0)

    return NextResponse.json({
      scores,
      stats: {
        averageScore,
        totalTasks,
        completedTasks,
        onTimeRate: totalTasks > 0 ? Math.round((onTimeTasks / totalTasks) * 100) : 0,
      },
      period,
    })
  } catch (error) {
    console.error('Error fetching productivity scores:', error)
    return NextResponse.json({ error: 'Failed to fetch productivity scores' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { userId, date, monitoringScore } = body
    const targetUserId = userId || authResult.user.profileId

    if (targetUserId !== authResult.user.profileId && !['admin', 'manager'].includes(authResult.user.role)) {
      return NextResponse.json({ error: 'Not authorized to update this data' }, { status: 403 })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .or(`id.eq.${targetUserId},auth_user_id.eq.${targetUserId}`)
      .maybeSingle()
    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    const targetDate = date ? new Date(date) : new Date()
    const startOfDay = new Date(targetDate)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(targetDate)
    endOfDay.setHours(23, 59, 59, 999)

    const { data: taskRecords } = await supabaseAdmin
      .from('task_records')
      .select('action')
      .eq('user_id', profile.id)
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString())

    const completedTasks = (taskRecords || []).filter((record) => record.action === 'completed').length
    const computedScore = Math.max(0, Math.min(100, completedTasks * 10 + Number(monitoringScore || 0)))

    const upsertPayload = buildProductivityUpsert({
      userId: profile.id,
      date: targetDate,
      score: computedScore,
      tasksCompleted: completedTasks,
      focusMinutes: Number(monitoringScore || 0),
    })

    const { data: productivityScore, error: upsertError } = await supabaseAdmin
      .from('productivity_records')
      .upsert(upsertPayload, { onConflict: 'user_id,date' })
      .select('*')
      .single()

    if (upsertError) throw upsertError
    return NextResponse.json({ productivityScore })
  } catch (error) {
    console.error('Error calculating productivity score:', error)
    return NextResponse.json({ error: 'Failed to calculate productivity score' }, { status: 500 })
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
    const period = searchParams.get('period') || 'week'
    const department = searchParams.get('department')
    const startDate = toRecordDate(getPeriodStart(period))

    let profileQuery = supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, department')
      .in('role', ['employee', 'manager'])
    if (department) {
      profileQuery = profileQuery.eq('department', department)
    }
    const { data: profiles, error: profilesError } = await profileQuery
    if (profilesError) throw profilesError

    const profileIds = (profiles || []).map((profile) => profile.id)
    if (profileIds.length === 0) {
      return NextResponse.json({ leaderboard: [] })
    }

    const { data: scores, error: scoresError } = await supabaseAdmin
      .from('productivity_records')
      .select('user_id, productivity_score, metadata, date')
      .in('user_id', profileIds)
      .gte('date', startDate)
    if (scoresError) throw scoresError

    const leaderboardMap = new Map<
      string,
      { userId: string; averageScore: number; totalTasks: number; samples: number }
    >()
    for (const score of scores || []) {
      const row = score as ProductivityRecordRow
      const existing = leaderboardMap.get(row.user_id) || {
        userId: row.user_id,
        averageScore: 0,
        totalTasks: 0,
        samples: 0,
      }
      existing.averageScore += Number(row.productivity_score || 0)
      existing.totalTasks += Number((row.metadata as Record<string, unknown>)?.tasks_completed || 0)
      existing.samples += 1
      leaderboardMap.set(row.user_id, existing)
    }

    const leaderboard = Array.from(leaderboardMap.values())
      .map((row) => {
        const profile = (profiles || []).find((p) => p.id === row.userId)
        return {
          userId: row.userId,
          userName: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'User',
          averageScore: row.samples > 0 ? Number((row.averageScore / row.samples).toFixed(2)) : 0,
          totalTasks: row.totalTasks,
        }
      })
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 10)

    return NextResponse.json({ leaderboard })
  } catch (error) {
    console.error('Error fetching leaderboard:', error)
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 })
  }
}






