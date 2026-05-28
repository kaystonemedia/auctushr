import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: string }
    const email = String(body.email || '').trim().toLowerCase()
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const redirectTo =
      process.env.NEXT_PUBLIC_PASSWORD_RESET_REDIRECT_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      undefined

    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(
      email,
      redirectTo ? { redirectTo } : undefined
    )

    // Return success regardless to avoid user enumeration.
    if (error) {
      console.warn('Forgot password reset warning:', error.message)
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}

