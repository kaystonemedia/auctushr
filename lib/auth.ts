import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'

export interface User {
  id: string
  uid: string
  email: string
  name: string
  role: 'admin' | 'manager' | 'employee'
  department?: string
  managerId?: string
  createdAt?: Date
  updatedAt?: Date
}

export type AuthOptions = Record<string, never>

export async function getServerSession(authOptions?: AuthOptions): Promise<{ user: User | null } | null> {
  try {
    void authOptions
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('sb-access-token')?.value

    if (!accessToken) {
      return null
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken)
    if (authError || !authData.user) {
      return null
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, auth_user_id, email, first_name, last_name, role, department, manager_id, created_at, updated_at')
      .eq('auth_user_id', authData.user.id)
      .single()

    if (profileError || !profile) {
      return null
    }

    const user: User = {
      id: profile.id,
      uid: profile.auth_user_id,
      email: profile.email ?? authData.user.email ?? '',
      name: `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim(),
      role: profile.role || 'employee',
      department: profile.department ?? undefined,
      managerId: profile.manager_id ?? undefined,
      createdAt: profile.created_at ? new Date(profile.created_at) : undefined,
      updatedAt: profile.updated_at ? new Date(profile.updated_at) : undefined
    }

    return { user }
  } catch (error) {
    console.error('Error getting server session:', error)
    return null
  }
}

export const authOptions: AuthOptions = {}







