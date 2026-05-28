import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['admin'])
  if (auth.error) return auth.error

  try {
    void request
    try {
      const { count: profileCount, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
      if (profileError) throw profileError

      return NextResponse.json({
        success: true,
        message: 'Supabase DB is working correctly',
        tests: {
          supabaseClientReady: true,
          profileCount: profileCount || 0
        }
      })
    } catch (error) {
      console.error('Error in supabase query test:', error)
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        tests: {
          supabaseClientReady: true
        }
      })
    }
  } catch (error) {
    console.error('Error in DB test:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'DB test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 