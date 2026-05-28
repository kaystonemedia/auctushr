import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { isMigratedFirestoreProfile } from '@/lib/migrated-profile'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()
    const normalizedEmail = String(email || '').trim().toLowerCase()

    if (!normalizedEmail || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, auth_user_id, has_password, metadata')
      .eq('email', normalizedEmail)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'No account found for this email' }, { status: 404 })
    }

    const isMigrated = isMigratedFirestoreProfile(profile.metadata)
    if (profile.auth_user_id && profile.has_password && !isMigrated) {
      return NextResponse.json({ error: 'Password has already been set for this account' }, { status: 409 })
    }

    let authUserId = profile.auth_user_id as string | null

    if (!authUserId) {
      const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true
      })
      if (createError || !createdUser.user) {
        return NextResponse.json({ error: createError?.message || 'Failed to create account' }, { status: 400 })
      }
      authUserId = createdUser.user.id
    } else {
      const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, { password })
      if (updateAuthError) {
        return NextResponse.json({ error: updateAuthError.message }, { status: 400 })
      }
    }

    const profileMetadata = (profile.metadata ?? {}) as Record<string, unknown>
    const { source_collection: _removed, ...metadataWithoutSource } = profileMetadata

    const { error: updateProfileError } = await supabaseAdmin
      .from('profiles')
      .update({
        auth_user_id: authUserId,
        has_password: true,
        requires_password_change: false,
        metadata: isMigrated ? metadataWithoutSource : profile.metadata,
        updated_at: new Date().toISOString()
      })
      .eq('id', profile.id)

    if (updateProfileError) {
      return NextResponse.json({ error: updateProfileError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('First-time password setup error:', error)
    return NextResponse.json({ error: 'Failed to set password' }, { status: 500 })
  }
}
