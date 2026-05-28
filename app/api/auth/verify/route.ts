import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { accessToken } = await request.json()

    if (!accessToken) {
      return NextResponse.json(
        { error: 'No access token provided' },
        { status: 401 }
      )
    }

    const { data, error } = await supabaseAdmin.auth.getUser(accessToken)
    if (error || !data.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    return NextResponse.json({ user: data.user })
  } catch (error) {
    console.error('Error verifying session:', error)
    return NextResponse.json(
      { error: 'Invalid session' },
      { status: 401 }
    )
  }
} 