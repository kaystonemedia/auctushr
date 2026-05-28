import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('sb-access-token')?.value
    const refreshToken = cookieStore.get('sb-refresh-token')?.value

    const clearSessionResponse = () => {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      response.cookies.set('sb-access-token', '', { expires: new Date(0), path: '/' })
      response.cookies.set('sb-refresh-token', '', { expires: new Date(0), path: '/' })
      return response
    }

    const buildTokenResponse = (nextAccessToken: string, nextRefreshToken?: string, expiresIn?: number) => {
      const response = NextResponse.json({ token: nextAccessToken })
      response.cookies.set('sb-access-token', nextAccessToken, {
        maxAge: expiresIn || 60 * 60,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
      })
      if (nextRefreshToken) {
        response.cookies.set('sb-refresh-token', nextRefreshToken, {
          maxAge: 60 * 60 * 24 * 14,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/'
        })
      }
      return response
    }

    if (!accessToken) {
      if (!refreshToken) {
        return clearSessionResponse()
      }
      const { data: refreshed, error: refreshError } = await supabaseAdmin.auth.refreshSession({
        refresh_token: refreshToken
      })
      if (refreshError || !refreshed.session?.access_token) {
        return clearSessionResponse()
      }
      return buildTokenResponse(
        refreshed.session.access_token,
        refreshed.session.refresh_token,
        refreshed.session.expires_in
      )
    }

    const { data: authData, error } = await supabaseAdmin.auth.getUser(accessToken)
    if (error || !authData.user) {
      if (!refreshToken) {
        return clearSessionResponse()
      }
      const { data: refreshed, error: refreshError } = await supabaseAdmin.auth.refreshSession({
        refresh_token: refreshToken
      })
      if (refreshError || !refreshed.session?.access_token) {
        return clearSessionResponse()
      }
      return buildTokenResponse(
        refreshed.session.access_token,
        refreshed.session.refresh_token,
        refreshed.session.expires_in
      )
    }

    return buildTokenResponse(accessToken)
  } catch (error) {
    console.error('Failed to fetch auth token:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
