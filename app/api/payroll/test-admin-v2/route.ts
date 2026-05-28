import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['admin'])
  if (auth.error) return auth.error

  try {
    void request
    const { count, error } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Supabase admin test successful',
      snapshotSize: count || 0
    })
  } catch (error) {
    console.error('Error in admin v2 test:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}