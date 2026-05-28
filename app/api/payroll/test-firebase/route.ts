import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['admin'])
  if (auth.error) return auth.error

  try {
    void request
    const status: {
      dbConnected: boolean
      tables: string[]
      error: string | null
      sampleDocument?: Record<string, unknown>
    } = {
      dbConnected: false,
      tables: [],
      error: null
    }

    try {
      const { data: profileRows, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id, email, role')
        .limit(1)
      if (profileError) {
        throw profileError
      }
      status.dbConnected = true
      status.tables.push('profiles')
      if (profileRows && profileRows.length > 0) {
        status.sampleDocument = profileRows[0] as Record<string, unknown>
      }
    } catch (dbError) {
      console.error('Supabase access error:', dbError)
      status.error = dbError instanceof Error ? dbError.message : 'Unknown database error'
    }

    return NextResponse.json({
      success: status.dbConnected,
      status,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error in Supabase test:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Supabase test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 