import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (authResult.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(500, Math.max(1, Number(searchParams.get('limit') || '200')))

    const { data, error } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error

    const rows = (data || []).map((row) => ({
      id: row.id,
      action: row.action,
      actorId: row.actor_id || undefined,
      actorRole: undefined,
      targetType: row.entity_type || undefined,
      targetId: row.entity_id || undefined,
      outcome: 'success' as const,
      message: String((row.details as Record<string, unknown>)?.message || row.action),
      createdAt: row.created_at || null,
    }))

    return NextResponse.json({ rows })
  } catch (error) {
    console.error('Audit logs GET error:', error)
    return NextResponse.json({ error: 'Failed to load audit logs' }, { status: 500 })
  }
}

