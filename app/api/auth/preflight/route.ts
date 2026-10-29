import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { isMigratedFirestoreProfile, profileNeedsPasswordSetup } from '@/lib/migrated-profile'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const email = String(searchParams.get('email') || '').trim().toLowerCase()
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, role, has_password, requires_password_change, auth_user_id')
      .eq('email', email)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({
        exists: false,
        hasPassword: false,
        requiresPasswordChange: false,
        role: null
      })
    }

    const needsPasswordSetup = profileNeedsPasswordSetup(profile)

    // Invited users can only create their first password from their invite link.
    let requiresInviteLink = false
    if (needsPasswordSetup && profile.auth_user_id) {
      const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(profile.auth_user_id)
      requiresInviteLink = authUserData?.user?.user_metadata?.requires_password_setup === true
    }

    return NextResponse.json({
      requiresInviteLink,
      exists: true,
      id: profile.id,
      uid: profile.auth_user_id || null,
      hasPassword: Boolean(profile.has_password) && !needsPasswordSetup,
      needsPasswordSetup,
      isMigrated: isMigratedFirestoreProfile(profile.metadata),
      requiresPasswordChange: Boolean(profile.requires_password_change),
      role: profile.role || 'employee',
      hasAuthUser: Boolean(profile.auth_user_id)
    })
  } catch (error) {
    console.error('Auth preflight error:', error)
    return NextResponse.json({ error: 'Failed to verify account' }, { status: 500 })
  }
}
