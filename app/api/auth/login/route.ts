import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { isMigratedFirestoreProfile, profileNeedsPasswordSetup } from '@/lib/migrated-profile'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()
    const normalizedEmail = String(email || '').trim().toLowerCase()

    if (!normalizedEmail || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase environment is not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password
    })
    if (signInError || !signInData.session || !signInData.user) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id, auth_user_id, has_password, requires_password_change, metadata')
        .eq('email', normalizedEmail)
        .maybeSingle()

      if (profile && profileNeedsPasswordSetup(profile)) {
        const isMigrated = isMigratedFirestoreProfile(profile.metadata)
        if (isMigrated && profile.has_password) {
          await supabaseAdmin
            .from('profiles')
            .update({
              has_password: false,
              requires_password_change: true,
              updated_at: new Date().toISOString()
            })
            .eq('id', profile.id)
        }

        return NextResponse.json(
          { error: 'ACCOUNT_NOT_INITIALIZED' },
          { status: 409 }
        )
      }

      return NextResponse.json({ error: signInError?.message || 'Invalid credentials' }, { status: 401 })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, role, first_name, last_name, requires_password_change')
      .eq('auth_user_id', signInData.user.id)
      .single()

    const response = NextResponse.json({
      user: {
        id: signInData.user.id,
        email: signInData.user.email,
        role: profile?.role || 'employee',
        name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(),
        requiresPasswordChange: profile?.requires_password_change || false
      }
    })

    response.cookies.set('sb-access-token', signInData.session.access_token, {
      maxAge: signInData.session.expires_in || 60 * 60,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    })
    response.cookies.set('sb-refresh-token', signInData.session.refresh_token, {
      maxAge: 60 * 60 * 24 * 14,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Failed to sign in' },
      { status: 500 }
    )
  }
} 