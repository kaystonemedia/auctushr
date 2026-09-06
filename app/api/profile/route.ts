import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * Self-service profile update. Any authenticated user can edit their own
 * contact/payment details here — nothing role- or salary-related, that stays
 * behind the admin-only /api/employees route.
 */
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const updatePayload: Record<string, unknown> = {}

    if (typeof body.name === 'string') {
      const [firstName, ...rest] = body.name.trim().split(/\s+/)
      updatePayload.first_name = firstName || ''
      updatePayload.last_name = rest.join(' ')
    }
    if ('mobileNumber' in body) {
      updatePayload.mobile_number = body.mobileNumber || null
    }
    if ('bankAccount' in body) {
      updatePayload.bank_account = body.bankAccount || null
    }
    if ('ssnitNumber' in body) {
      updatePayload.ssnit_number = body.ssnitNumber || null
    }
    if ('emergencyContact' in body) {
      updatePayload.emergency_contact = body.emergencyContact || null
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 })
    }

    updatePayload.updated_at = new Date().toISOString()

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updatePayload)
      .eq('id', authResult.user.profileId)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({
      user: {
        id: data.id,
        uid: data.auth_user_id,
        email: data.email || '',
        firstName: data.first_name || '',
        lastName: data.last_name || '',
        name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
        role: data.role || 'employee',
        department: data.department || undefined,
        position: data.position || undefined,
        managerId: data.manager_id || null,
        phone: data.phone || undefined,
        mobileNumber: data.mobile_number || null,
        ssnitNumber: data.ssnit_number || null,
        bankAccount: data.bank_account || null,
        emergencyContact: data.emergency_contact || null,
        updatedAt: data.updated_at ? new Date(data.updated_at) : undefined
      }
    })
  } catch (error) {
    console.error('Error in PATCH /api/profile:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update profile' },
      { status: 500 }
    )
  }
}
