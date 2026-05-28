import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['admin'])
  if (auth.error) return auth.error

  return NextResponse.json({
    success: true,
    message: 'Basic API route is working',
    timestamp: new Date().toISOString(),
    method: 'GET'
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['admin'])
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    return NextResponse.json({
      success: true,
      message: 'Basic API route is working',
      timestamp: new Date().toISOString(),
      method: 'POST',
      receivedData: body
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Error parsing request body',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 400 })
  }
} 