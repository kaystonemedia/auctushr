import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['admin'])
  if (auth.error) return auth.error

  try {
    void request
    try {
      const { count, error } = await supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
      if (error) throw error
      return NextResponse.json({
        success: true,
        message: 'Supabase admin v3-style test successful',
        tests: {
          clientInitialized: true,
          queryExecuted: true,
          rowCount: count || 0
        }
      })
    } catch (error) {
      console.error('Database access error:', error)
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown database error',
        tests: {
          clientInitialized: true,
          queryExecuted: false
        }
      })
    }
    
  } catch (error) {
    console.error('Error in admin v3 test:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Admin v3 test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 