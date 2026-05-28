import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { authenticateRequest } from '@/lib/api-auth'

export async function POST(request: NextRequest) {
  try {
    const { userId, userName, action, loginTime, logoutTime } = await request.json()

    if (!userId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Resolve user by profile id or auth uid
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, auth_user_id, email, first_name, last_name, metadata')
      .or(`id.eq.${userId},auth_user_id.eq.${userId}`)
      .maybeSingle()

    if (profileError) {
      throw profileError
    }

    if (!profile) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const existingMetadata = (profile.metadata || {}) as Record<string, unknown>
    const updateMetadata: Record<string, unknown> = {
      ...existingMetadata,
      lastActivityAt: new Date().toISOString()
    }

    let auditAction = 'session.activity'
    if (action === 'login') {
      updateMetadata.lastLoginAt = loginTime || new Date().toISOString()
      updateMetadata.isActive = true
      auditAction = 'session.login'
    } else if (action === 'logout') {
      updateMetadata.lastLogoutAt = logoutTime || new Date().toISOString()
      updateMetadata.isActive = false
      auditAction = 'session.logout'
    }

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ metadata: updateMetadata })
      .eq('id', profile.id)

    if (updateError) {
      throw updateError
    }

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: authResult.user.profileId,
      action: auditAction,
      entity_type: 'profile',
      entity_id: profile.id,
      details: {
        userId,
        userName: userName || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email,
        action,
        loginTime,
        logoutTime
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error tracking session:', error)
    return NextResponse.json(
      { error: 'Failed to track session' },
      { status: 500 }
    )
  }
}





