import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['admin'])
  if (auth.error) return auth.error

  try {
    void request
    // Check env variables
    const envCheck = {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    }

    // Show actual values (masked for security)
    const envValues = {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 20)}...` : 'NOT_SET',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? `${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20)}...` : 'NOT_SET',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? `${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...` : 'NOT_SET'
    }

    // Try a Supabase query
    const adminImportSuccess = true
    let sampleCount = 0
    let error = null
    let status: Record<string, unknown> | null = null

    try {
      const { count, error: countError } = await supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
      if (countError) throw countError
      sampleCount = count || 0
      status = { provider: 'supabase', reachable: true }
    } catch (queryError) {
      error = queryError instanceof Error ? queryError.message : 'Unknown query error'
      status = { provider: 'supabase', reachable: false }
    }

    return NextResponse.json({
      success: true,
      envCheck,
      envValues,
      adminImportSuccess,
      hasAdminDb: true,
      sampleCount,
      status,
      error
    })

  } catch (error) {
    console.error('Error in admin test:', error)
    return NextResponse.json(
      { 
        error: 'Admin test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 