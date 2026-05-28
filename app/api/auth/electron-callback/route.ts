import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    console.log('Electron callback API called')
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get('token')
    const state = searchParams.get('state')
    
    console.log('Callback API params:', { 
      hasToken: !!token, 
      state, 
      tokenPrefix: token?.substring(0, 20) + '...' 
    })
    
    if (!token) {
      const cookieToken = request.cookies.get('sb-access-token')?.value
      if (cookieToken) {
        console.log('No query token provided, using session cookie token')
        request.nextUrl.searchParams.set('token', cookieToken)
      } else {
        console.error('No token provided to callback API')
        return NextResponse.redirect(
          `auctushr://auth/callback?success=false&error=no_token`
        )
      }
    }

    const effectiveToken = request.nextUrl.searchParams.get('token') || token
    console.log('Verifying Supabase token...')
    const { data: authData, error: tokenError } = await supabaseAdmin.auth.getUser(effectiveToken!)
    if (tokenError || !authData.user) {
      console.error('Token verification failed')
      return NextResponse.redirect(
        `auctushr://auth/callback?success=false&error=invalid_token`
      )
    }

    const authUser = authData.user
    console.log('Token verified for user:', authUser.email)

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, role, department, manager_id, first_name, last_name')
      .eq('auth_user_id', authUser.id)
      .maybeSingle()

    const userData = {
      uid: authUser.id,
      email: authUser.email,
      name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || authUser.user_metadata?.full_name || authUser.email,
      photoURL: authUser.user_metadata?.avatar_url || null,
      emailVerified: !!authUser.email_confirmed_at,
      role: profile?.role || 'employee',
      department: profile?.department || null,
      managerId: profile?.manager_id || null
    }

    console.log('Prepared user data:', { email: userData.email, role: userData.role })

    // Encode user data for URL
    const encodedUser = encodeURIComponent(JSON.stringify(userData))
    
    // Check if this is using HTTP callback (new method) or protocol callback (old method)
    const referer = request.headers.get('referer') || '';
    const callbackParam = searchParams.get('callback') || '';
    
    const isHttpCallback = referer.includes('callback=http%3A%2F%2Flocalhost') || 
                          referer.includes('callback=http://localhost') ||
                          callbackParam.includes('localhost:8765');
    
    console.log('Callback detection:', { referer, callbackParam, isHttpCallback });
    
    if (isHttpCallback) {
      // New HTTP callback method - redirect to localhost callback server
      const callbackUrl = `http://localhost:8765/oauth/callback?success=true&token=${effectiveToken}&user=${encodedUser}&state=${state || ''}`
      console.log('Redirecting to HTTP callback server:', callbackUrl)
      return NextResponse.redirect(callbackUrl)
    } else {
      // Old protocol callback method
      const callbackUrl = `auctushr://auth/callback?success=true&token=${effectiveToken}&user=${encodedUser}&state=${state || ''}`
      console.log('Redirecting to protocol handler:', callbackUrl)
      return NextResponse.redirect(callbackUrl)
    }
    
  } catch (error) {
    console.error('Electron OAuth callback error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.redirect(
      `auctushr://auth/callback?success=false&error=${encodeURIComponent(errorMessage)}`
    )
  }
}

export async function POST(request: NextRequest) {
  // Handle POST requests if needed
  return GET(request)
}
