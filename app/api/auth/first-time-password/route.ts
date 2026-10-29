import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { isMigratedFirestoreProfile } from '@/lib/migrated-profile'
import { validateSignUpPassword } from '@/lib/password-validation'

export const dynamic = 'force-dynamic'

const INVITE_REQUIRED_MESSAGE =
  'For security, please open the link in your invite email to create your password. If you cannot find it, ask your administrator to resend the invite.'

export async function POST(request: Request) {
  try {
    const { email, password, inviteToken } = await request.json()
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
    let authUserMetadata: Record<string, unknown> | null = null

    // Users created through POST /api/employees can only set their first password
    // with the invite code from their email (?invite=... on the sign-in link);
    // otherwise anyone who knows their email address could claim the account here.
    if (authUserId) {
      const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(authUserId)
      if (authUserData?.user?.user_metadata?.requires_password_setup === true) {
        const inviteError = NextResponse.json(
          { error: INVITE_REQUIRED_MESSAGE },
          { status: 403 }
        )
        if (!inviteToken) return inviteError

        // Check the password first: verifying the invite code uses it up.
        const passwordError = validateSignUpPassword(password)
        if (passwordError) {
          return NextResponse.json({ error: passwordError }, { status: 400 })
        }

        const verifier = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } }
        )
        const { data: verified, error: verifyError } = await verifier.auth.verifyOtp({
          type: 'recovery',
          token_hash: inviteToken
        })
        if (verifyError || verified.user?.id !== authUserId) {
          return NextResponse.json(
            { error: 'This invite link is invalid, has expired, or belongs to a different email. Ask your administrator to resend the invite.' },
            { status: 403 }
          )
        }
        authUserMetadata = { ...(authUserData.user.user_metadata || {}), requires_password_setup: false }
      }
    }

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
      const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
        authUserId,
        authUserMetadata ? { password, user_metadata: authUserMetadata } : { password }
      )
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
