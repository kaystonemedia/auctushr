import { NextRequest, NextResponse } from 'next/server'

/** Legacy Firebase payslip route — use /api/payroll/payslip or /api/payroll/payslip-working instead. */

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      deprecated: true,
      message: 'This endpoint used Firebase and has been retired. Use GET /api/payroll/payslip-working instead.',
    },
    { status: 410 }
  )
}

export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      deprecated: true,
      message: 'This endpoint used Firebase and has been retired. Use POST /api/payroll/payslip or /api/payroll/payslip-working instead.',
    },
    { status: 410 }
  )
}
