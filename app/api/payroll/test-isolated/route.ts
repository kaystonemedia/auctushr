import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['admin'])
  if (auth.error) return auth.error

  try {
    void request
    try {
      const { data: sampleRows, error } = await supabaseAdmin
        .from('profiles')
        .select('id, email, role')
        .limit(1)
      if (error) throw error
      return NextResponse.json({
        success: true,
        message: 'Isolated Supabase test successful',
        tests: {
          supabaseImported: true,
          queryExecuted: true,
          snapshotSize: sampleRows?.length || 0
        }
      })
    } catch (error) {
      console.error('Error in collection/query test:', error)
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        tests: {
          supabaseImported: true,
          queryExecuted: false
        }
      })
    }
    
  } catch (error) {
    console.error('Error in isolated test:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Isolated test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 