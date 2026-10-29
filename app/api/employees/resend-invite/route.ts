import { NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { sendOnboardingInvite } from "@/lib/onboarding-invite"

export const dynamic = 'force-dynamic'

// Re-sends the onboarding invite (with a fresh invite link) to someone who
// has not set a password yet. Same role rules as creating the user: admins can
// resend to anyone, managers only to employees.
export async function POST(request: Request) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (authResult.user.role !== 'admin' && authResult.user.role !== 'manager') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({})) as { id?: string }
    if (!body.id) {
      return NextResponse.json({ error: 'Employee id is required' }, { status: 400 })
    }

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, first_name, last_name, role, position, department, has_password, auth_user_id')
      .eq('id', body.id)
      .maybeSingle()

    if (error) throw error
    if (!profile) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }
    if (authResult.user.role === 'manager' && profile.role !== 'employee') {
      return NextResponse.json({ error: "Managers can only resend invites to employees" }, { status: 403 })
    }
    if (profile.has_password) {
      return NextResponse.json({ error: 'This person has already set a password' }, { status: 409 })
    }
    if (!profile.auth_user_id) {
      return NextResponse.json({ error: 'This account has no login yet and cannot be invited' }, { status: 409 })
    }

    const invite = await sendOnboardingInvite({
      email: profile.email,
      name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
      role: profile.role === 'admin' || profile.role === 'manager' ? profile.role : 'employee',
      position: profile.position,
      department: profile.department,
      origin: new URL(request.url).origin
    })

    if (!invite.sent) {
      return NextResponse.json({ error: invite.error || 'Failed to send invite' }, { status: 502 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in POST /api/employees/resend-invite:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
