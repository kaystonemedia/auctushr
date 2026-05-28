import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

async function mapDepartment(row: {
  id: string
  name: string
  description: string | null
  manager_profile_id: string | null
  created_at: string
  updated_at: string
}) {
  const { count } = await supabaseAdmin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .or(`department_id.eq.${row.id},department.eq.${row.name}`)

  let managerName = ''
  if (row.manager_profile_id) {
    const { data: mgr } = await supabaseAdmin
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', row.manager_profile_id)
      .maybeSingle()
    if (mgr) {
      managerName = `${mgr.first_name || ''} ${mgr.last_name || ''}`.trim()
    }
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    managerId: row.manager_profile_id,
    managerName,
    employeeCount: count || 0,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabaseAdmin
      .from('departments')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw error

    const departments = await Promise.all((data || []).map(mapDepartment))
    return NextResponse.json({ departments })
  } catch (error) {
    console.error('Departments GET error:', error)
    return NextResponse.json({ error: 'Failed to load departments' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (authResult.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, managerId } = body as {
      name: string
      description?: string
      managerId?: string | null
    }

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('departments')
      .insert({
        name: name.trim(),
        description: description || '',
        manager_profile_id: managerId && managerId !== 'none' ? managerId : null,
      })
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ department: await mapDepartment(data) })
  } catch (error) {
    console.error('Departments POST error:', error)
    return NextResponse.json({ error: 'Failed to create department' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (authResult.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { id, name, description, managerId } = body as {
      id: string
      name: string
      description?: string
      managerId?: string | null
    }

    if (!id) {
      return NextResponse.json({ error: 'Department id is required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('departments')
      .update({
        name: name?.trim(),
        description: description ?? '',
        manager_profile_id: managerId && managerId !== 'none' ? managerId : null,
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ department: await mapDepartment(data) })
  } catch (error) {
    console.error('Departments PUT error:', error)
    return NextResponse.json({ error: 'Failed to update department' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (authResult.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Department id is required' }, { status: 400 })
    }

    const { count } = await supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .or(`department_id.eq.${id}`)

    if ((count || 0) > 0) {
      return NextResponse.json(
        { error: 'Cannot delete department with assigned employees' },
        { status: 409 }
      )
    }

    const { error } = await supabaseAdmin.from('departments').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Departments DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete department' }, { status: 500 })
  }
}
