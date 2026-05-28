import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { currentPassword, newPassword } = await request.json()
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current and new passwords are required' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const accessToken = cookieStore.get('sb-access-token')?.value
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken)
    if (authError || !authData.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase environment is not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: authData.user.email,
      password: currentPassword
    })
    if (signInError) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
    }

    const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(authData.user.id, {
      password: newPassword
    })
    if (updateAuthError) {
      return NextResponse.json({ error: updateAuthError.message }, { status: 400 })
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        requires_password_change: false,
        updated_at: new Date().toISOString()
      })
      .eq('auth_user_id', authData.user.id)

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Change password error:', error)
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 })
  }
}
