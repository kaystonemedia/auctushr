import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * Admin-only: force a user back through the first-time-password setup flow.
 *
 * Useful for migrated accounts whose Supabase Auth password is a placeholder
 * (set by `migrate-to-supabase.js`) and therefore unknown to the end user.
 *
 * Body: { email: string, sendResetEmail?: boolean }
 *
 * Behaviour:
 *   - Flips `has_password = false` and `requires_password_change = true` on
 *     the matching profile so the next login lands on the setup screen.
 *   - When `sendResetEmail` is true (default), also asks Supabase Auth to
 *     send a password recovery email so the user can complete setup
 *     without administrator hand-holding.
 *
 * Bootstrap escape hatch:
 *   If the caller cannot authenticate as an admin (e.g. every admin is still
 *   locked out post-migration), provide
 *     Authorization: Bearer <SUPABASE_MIGRATION_ADMIN_SECRET>
 *   matching the env var of the same name. This is intentionally absent in
 *   normal deployments and should be unset once recovery is complete.
 */
export async function POST(request: NextRequest) {
  try {
    const bootstrapSecret = process.env.SUPABASE_MIGRATION_ADMIN_SECRET
    const authHeader = request.headers.get('Authorization') || ''
    const presentedBootstrapToken = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : ''

    const usingBootstrap =
      bootstrapSecret && presentedBootstrapToken && presentedBootstrapToken === bootstrapSecret

    if (!usingBootstrap) {
      const { error: authError } = await requireRole(request, ['admin'])
      if (authError) return authError
    }

    const body = await request.json().catch(() => ({})) as {
      email?: string
      sendResetEmail?: boolean
    }
    const normalizedEmail = String(body.email || '').trim().toLowerCase()
    const sendResetEmail = body.sendResetEmail !== false

    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, auth_user_id')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }
    if (!profile) {
      return NextResponse.json({ error: 'No account found for this email' }, { status: 404 })
    }

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        has_password: false,
        requires_password_change: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', profile.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    let resetEmailSent = false
    let resetEmailError: string | null = null
    if (sendResetEmail) {
      const redirectTo =
        process.env.NEXT_PUBLIC_PASSWORD_RESET_REDIRECT_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        undefined

      const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(
        normalizedEmail,
        redirectTo ? { redirectTo } : undefined
      )
      if (resetError) {
        resetEmailError = resetError.message
      } else {
        resetEmailSent = true
      }
    }

    return NextResponse.json({
      success: true,
      email: normalizedEmail,
      profileId: profile.id,
      hasAuthUser: Boolean(profile.auth_user_id),
      resetEmailSent,
      resetEmailError
    })
  } catch (error) {
    console.error('Admin reset-password error:', error)
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 })
  }
}
