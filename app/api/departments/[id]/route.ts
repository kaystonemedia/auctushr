import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const { data: dept, error: deptError } = await supabaseAdmin
      .from('departments')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (deptError) throw deptError
    if (!dept) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 })
    }

    let managerName = ''
    if (dept.manager_profile_id) {
      const { data: mgr } = await supabaseAdmin
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', dept.manager_profile_id)
        .maybeSingle()
      if (mgr) {
        managerName = `${mgr.first_name || ''} ${mgr.last_name || ''}`.trim()
      }
    }

    const { data: employees, error: empError } = await supabaseAdmin
      .from('profiles')
      .select('id, auth_user_id, email, first_name, last_name, position, role, status, department, manager_id, metadata')
      .or(`department_id.eq.${id},department.eq.${dept.name}`)
      .order('first_name', { ascending: true })

    if (empError) throw empError

    const employeeList = (employees || []).map((e) => ({
      id: e.id,
      uid: e.auth_user_id,
      firstName: e.first_name || '',
      lastName: e.last_name || '',
      email: e.email || '',
      position: e.position || '',
      role: e.role || 'employee',
      status: e.status || 'active',
      department: e.department || dept.name,
      managerId: e.manager_id,
      avatar: (e.metadata as Record<string, unknown>)?.avatar_url as string | undefined,
    }))

    return NextResponse.json({
      department: {
        id: dept.id,
        name: dept.name,
        description: dept.description || '',
        managerId: dept.manager_profile_id,
        managerName,
        employeeCount: employeeList.length,
        createdAt: dept.created_at,
        updatedAt: dept.updated_at,
      },
      employees: employeeList,
    })
  } catch (error) {
    console.error('Department GET error:', error)
    return NextResponse.json({ error: 'Failed to load department' }, { status: 500 })
  }
}
