import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Renews the desktop app's access token. The desktop app gets its own refresh token
// from /api/auth/electron-callback and sends it here before the access token expires.
// Supabase rotates refresh tokens, so the caller must store the new one it gets back.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const refreshToken = typeof body?.refreshToken === 'string' ? body.refreshToken : ''
    if (!refreshToken) {
      return NextResponse.json({ error: 'refreshToken is required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin.auth.refreshSession({ refresh_token: refreshToken })
    if (error || !data.session?.access_token) {
      return NextResponse.json({ error: 'Session expired, please sign in again' }, { status: 401 })
    }

    return NextResponse.json({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
    })
  } catch (error) {
    console.error('Electron token refresh error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
