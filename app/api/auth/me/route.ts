import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('sb-access-token')?.value
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken)
    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('auth_user_id', authData.user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    return NextResponse.json({
      user: {
        id: profile.id,
        uid: profile.auth_user_id,
        email: profile.email || authData.user.email || '',
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
        role: profile.role || 'employee',
        department: profile.department || undefined,
        position: profile.position || undefined,
        managerId: profile.manager_id || null,
        phone: profile.phone || undefined,
        mobileNumber: profile.mobile_number || null,
        bankAccount: profile.bank_account || null,
        emergencyContact: profile.emergency_contact || null,
        avatar:
          (profile.metadata as Record<string, unknown> | null)?.avatar_url?.toString() ||
          undefined,
        createdAt: profile.created_at ? new Date(profile.created_at) : undefined,
        updatedAt: profile.updated_at ? new Date(profile.updated_at) : undefined,
        requiresPasswordChange: profile.requires_password_change || false
      }
    })
  } catch (error) {
    console.error('Error fetching auth me:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
