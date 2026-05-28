import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const requester = authResult.user
    if (requester.role !== 'admin' && requester.role !== 'manager') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { employeeId } = await params
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    const { data: employeeProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, auth_user_id, first_name, last_name, email, department, role, manager_id')
      .or(`id.eq.${employeeId},auth_user_id.eq.${employeeId}`)
      .maybeSingle()
    if (!employeeProfile) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // If requester is a manager, verify they manage this employee
    if (requester.role === 'manager' && employeeProfile.manager_id !== requester.profileId) {
        return NextResponse.json({ error: 'Not authorized to view this employee' }, { status: 403 })
    }

    const employee = {
      id: employeeProfile.id,
      name: `${employeeProfile.first_name || ''} ${employeeProfile.last_name || ''}`.trim(),
      email: employeeProfile.email || '',
      department: employeeProfile.department,
      role: employeeProfile.role || 'employee',
      isActive: true
    }

    const startDate = new Date(`${date}T00:00:00Z`)
    const endDate = new Date(`${date}T23:59:59Z`)

    const { data: events, error: eventsError } = await supabaseAdmin
      .from('monitoring_events')
      .select('*')
      .eq('employee_id', employeeProfile.id)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false })
    if (eventsError) throw eventsError

    const screenshots = (events || [])
      .filter((event) => event.event_type === 'screenshot')
      .map((event) => {
        const payload = (event.payload || {}) as Record<string, unknown>
        return {
          id: event.id,
          ...payload,
          timestamp: payload.timestamp || event.created_at,
        }
      })

    const activities = (events || [])
      .filter((event) => event.event_type !== 'screenshot')
      .map((event) => {
        const payload = (event.payload || {}) as Record<string, unknown>
        return {
          id: event.id,
          ...payload,
          timestamp: payload.timestamp || event.created_at,
        }
      })

    // Calculate stats
    const totalWorkingTime = activities.length > 0 
      ? (new Date(activities[0].timestamp).getTime() - new Date(activities[activities.length - 1].timestamp).getTime()) / (1000 * 60 * 60)
      : 0

    const totalIdleTime = activities.reduce((sum: number, activity: Record<string, unknown>) => sum + Number(activity.idleTime || 0), 0) / (1000 * 60 * 60)
    const productiveTime = totalWorkingTime > 0 ? ((totalWorkingTime - totalIdleTime) / totalWorkingTime) * 100 : 0

    const stats = {
      totalScreenshots: screenshots.length,
      totalActivities: activities.length,
      workingHours: Math.max(0, totalWorkingTime),
      idleHours: Math.max(0, totalIdleTime),
      productiveTime: Math.max(0, Math.min(100, productiveTime))
    }

    return NextResponse.json({
      success: true,
      data: {
        employee,
        date,
        screenshots,
        activities,
        stats
      }
    })

  } catch (error) {
    console.error('Employee monitoring data fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}