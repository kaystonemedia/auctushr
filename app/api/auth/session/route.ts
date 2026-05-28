import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Supabase environment is not configured' },
        { status: 500 }
      )
    }

    let accessToken: string | undefined = body?.accessToken
    let refreshToken: string | undefined = body?.refreshToken
    let expiresIn: number = body?.expiresIn ?? 60 * 60 // 1 hour

    // Backward-compatible path for clients that only send credentials.
    if ((!accessToken || !refreshToken) && body?.email && body?.password) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey)
      const { data, error } = await supabase.auth.signInWithPassword({
        email: body.email,
        password: body.password
      })

      if (error || !data.session) {
        return NextResponse.json({ error: error?.message || 'Invalid credentials' }, { status: 401 })
      }

      accessToken = data.session.access_token
      refreshToken = data.session.refresh_token
      expiresIn = data.session.expires_in ?? expiresIn
    }

    if (!accessToken || !refreshToken) {
      return NextResponse.json(
        { error: 'Missing Supabase session tokens' },
        { status: 400 }
      )
    }

    const response = NextResponse.json({ status: 'success' })
    response.cookies.set('sb-access-token', accessToken, {
      maxAge: expiresIn,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    })
    response.cookies.set('sb-refresh-token', refreshToken, {
      maxAge: 60 * 60 * 24 * 14, // 14 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    })

    return response
  } catch (error) {
    console.error('Error creating session:', error)
    return NextResponse.json(
      { error: 'Unable to create session' },
      { status: 500 }
    )
  }
}