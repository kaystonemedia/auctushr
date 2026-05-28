import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { email, password, name, role } = await request.json()
    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const selectedRole = role === 'admin' || role === 'manager' || role === 'employee' ? role : 'employee'
    const [firstName, ...lastNameParts] = String(name).trim().split(' ')
    const lastName = lastNameParts.join(' ')

    const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: String(email).trim().toLowerCase(),
      password: String(password),
      email_confirm: true
    })

    if (createError || !createdUser.user) {
      return NextResponse.json({ error: createError?.message || 'Failed to create user' }, { status: 400 })
    }

    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      auth_user_id: createdUser.user.id,
      email: createdUser.user.email || String(email).trim().toLowerCase(),
      first_name: firstName || '',
      last_name: lastName || '',
      role: selectedRole,
      has_password: true,
      requires_password_change: false,
      status: 'active'
    }, { onConflict: 'auth_user_id' })

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json({ error: 'Failed to register user' }, { status: 500 })
  }
}
