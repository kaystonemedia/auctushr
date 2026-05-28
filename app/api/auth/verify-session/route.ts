import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('sb-access-token')?.value

    if (!accessToken) {
      return NextResponse.json(
        { error: 'No session token' },
        { status: 401 }
      )
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken)
    if (authError || !authData.user) {
      throw new Error(authError?.message || 'Invalid session token')
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('auth_user_id', authData.user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    const response = NextResponse.json({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role: profile.role || 'employee'
      }
    })

    // Set the user role cookie
    response.cookies.set('user-role', profile.role || 'employee', {
      maxAge: 60 * 60 * 24 * 7, // 7 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    })

    return response
  } catch (error) {
    console.error('Error verifying session:', error)
    
    // Clear the session cookie if it's invalid
    const response = NextResponse.json(
      { error: 'Invalid session' },
      { status: 401 }
    )
    response.cookies.set('sb-access-token', '', { expires: new Date(0), path: '/' })
    response.cookies.set('sb-refresh-token', '', { expires: new Date(0), path: '/' })
    response.cookies.set('user-role', '', { expires: new Date(0), path: '/' })
    
    return response
  }
} 