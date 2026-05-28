import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'

export type UserRole = 'admin' | 'manager' | 'employee'

export interface AuthenticatedUser {
  uid: string
  email?: string
  role: UserRole
  department?: string
  managerId?: string
  profileId: string
}

export interface AuthResult {
  user: AuthenticatedUser | null
  error: NextResponse | null
}

/**
 * Authenticate user from request (supports Bearer token or session cookie)
 */
export async function authenticateRequest(request: NextRequest | Request): Promise<AuthResult> {
  try {
    let accessToken: string | null = null

    // Bearer token takes priority for API calls from non-browser clients.
    const authHeader = request.headers.get('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      accessToken = authHeader.split('Bearer ')[1]
    } else {
      const cookieStore = await cookies()
      accessToken = cookieStore.get('sb-access-token')?.value || null
    }

    if (!accessToken) {
      return {
        user: null,
        error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken)
    if (authError || !authData.user) {
      return {
        user: null,
        error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role, department, manager_id, auth_user_id')
      .eq('auth_user_id', authData.user.id)
      .single()

    if (profileError || !profile) {
      return {
        user: null,
        error: NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
    }

    const role = (profile.role || 'employee') as UserRole
    const user: AuthenticatedUser = {
      uid: profile.auth_user_id,
      email: profile.email ?? authData.user.email,
      role,
      department: profile.department ?? undefined,
      managerId: profile.manager_id ?? undefined,
      profileId: profile.id
    }

    return { user, error: null }
  } catch (error) {
    console.error('Authentication error:', error)
    return {
      user: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }
}

/**
 * Require user to have one of the specified roles
 */
export async function requireRole(
  request: NextRequest | Request,
  allowedRoles: UserRole[]
): Promise<{ user: AuthenticatedUser; error: null } | { user: null; error: NextResponse }> {
  const authResult = await authenticateRequest(request)

  if (authResult.error || !authResult.user) {
    return authResult
  }

  if (!allowedRoles.includes(authResult.user.role)) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Forbidden - insufficient permissions' }, { status: 403 })
    }
  }

  return { user: authResult.user, error: null }
}


