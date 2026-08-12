import { NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"

export async function GET(request: Request) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (authResult.user.role !== 'admin' && authResult.user.role !== 'manager') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    let query = supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (authResult.user.role === 'manager') {
      query = query.eq('manager_id', authResult.user.profileId)
    }

    const { data, error } = await query
    if (error) {
      throw error
    }

    const employees = (data || []).map((item) => ({
      id: item.id,
      uid: item.auth_user_id,
      email: item.email || '',
      firstName: item.first_name || '',
      lastName: item.last_name || '',
      role: item.role || 'employee',
      department: item.department || '',
      position: item.position || '',
      salary: Number(item.salary || 0),
      managerId: item.manager_id || null,
      status: item.status || 'active',
      hasPassword: item.has_password || false,
      hireDate: item.hire_date ? new Date(item.hire_date) : new Date(),
      createdAt: item.created_at ? new Date(item.created_at) : new Date(),
      updatedAt: item.updated_at ? new Date(item.updated_at) : new Date(),
      documents: item.documents || [],
      mobileNumber: item.mobile_number || null,
      bankAccount: item.bank_account || null,
      address: item.address || null,
      emergencyContact: item.emergency_contact || null
    }))

    return NextResponse.json({ employees })
  } catch (error) {
    console.error('Error in GET /api/employees:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (authResult.user.role !== 'admin' && authResult.user.role !== 'manager') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const body = await request.json()
    const role = body.role === 'admin' || body.role === 'manager' || body.role === 'employee' ? body.role : 'employee'
    if (authResult.user.role === 'manager' && role !== 'employee') {
      return NextResponse.json({ error: "Managers can only create employees" }, { status: 403 })
    }

    const email = String(body.email || '').trim().toLowerCase()
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existingProfile) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }

    const managerId = role === 'employee'
      ? (body.managerId || (authResult.user.role === 'manager' ? authResult.user.profileId : null))
      : null

    // profiles.auth_user_id is NOT NULL, so a Supabase Auth user must exist before
    // the profile row is created. The employee never learns this password — they
    // set their real one via the first-time-password flow, which just calls
    // auth.admin.updateUserById to replace it. Mirrors migrate-to-supabase.js.
    const placeholderPassword = `invite-${email}-${Date.now()}-${Math.random().toString(36).slice(2)}!Aa1`

    const { data: createdAuthUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: placeholderPassword,
      email_confirm: true,
      user_metadata: { requires_password_setup: true }
    })

    if (createAuthError || !createdAuthUser?.user) {
      return NextResponse.json(
        { error: createAuthError?.message || 'Failed to create authentication account for employee' },
        { status: 400 }
      )
    }

    const insertPayload = {
      auth_user_id: createdAuthUser.user.id,
      email,
      first_name: body.firstName || '',
      last_name: body.lastName || '',
      phone: body.phone || '',
      department: body.department || '',
      position: body.position || '',
      role,
      manager_id: managerId,
      has_password: false,
      requires_password_change: false,
      hire_date: body.hireDate ? new Date(body.hireDate).toISOString() : new Date().toISOString(),
      salary: Number(body.salary || 0),
      status: body.status || 'active',
      mobile_number: body.mobileNumber || null,
      bank_account: body.bankAccount || null,
      address: body.address || null,
      emergency_contact: body.emergencyContact || null,
      documents: body.documents || []
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .insert(insertPayload)
      .select('*')
      .single()

    if (error) {
      await supabaseAdmin.auth.admin.deleteUser(createdAuthUser.user.id)
      throw error
    }

    return NextResponse.json({
      employee: {
        id: data.id,
        uid: data.auth_user_id,
        email: data.email || '',
        firstName: data.first_name || '',
        lastName: data.last_name || '',
        role: data.role || 'employee',
        department: data.department || '',
        position: data.position || '',
        salary: Number(data.salary || 0),
        managerId: data.manager_id || null,
        status: data.status || 'active',
        hasPassword: data.has_password || false,
        hireDate: data.hire_date ? new Date(data.hire_date) : new Date(),
        createdAt: data.created_at ? new Date(data.created_at) : new Date(),
        updatedAt: data.updated_at ? new Date(data.updated_at) : new Date(),
        mobileNumber: data.mobile_number || null,
        bankAccount: data.bank_account || null,
        address: data.address || null,
        emergencyContact: data.emergency_contact || null,
        documents: data.documents || []
      }
    })
  } catch (error) {
    console.error('Error in POST /api/employees:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (authResult.user.role !== 'admin' && authResult.user.role !== 'manager') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const body = await request.json()
    const id = String(body.id || '').trim()
    if (!id) {
      return NextResponse.json({ error: 'Employee id is required' }, { status: 400 })
    }

    const updatePayload: Record<string, unknown> = {
      first_name: body.firstName,
      last_name: body.lastName,
      email: body.email ? String(body.email).trim().toLowerCase() : undefined,
      phone: body.phone,
      department: body.department,
      position: body.position,
      role: body.role,
      manager_id: body.managerId ?? null,
      has_password: body.hasPassword,
      hire_date: body.hireDate ? new Date(body.hireDate).toISOString() : undefined,
      salary: body.salary !== undefined ? Number(body.salary) : undefined,
      status: body.status,
      mobile_number: body.mobileNumber ?? null,
      bank_account: body.bankAccount ?? null,
      address: body.address ?? null,
      emergency_contact: body.emergencyContact ?? null,
      documents: body.documents ?? [],
      updated_at: new Date().toISOString()
    }

    Object.keys(updatePayload).forEach((key) => {
      if (updatePayload[key] === undefined) {
        delete updatePayload[key]
      }
    })

    if (authResult.user.role === 'manager' && updatePayload.role && updatePayload.role !== 'employee') {
      return NextResponse.json({ error: "Managers can only manage employees" }, { status: 403 })
    }

    let query = supabaseAdmin.from('profiles').update(updatePayload).eq('id', id)
    if (authResult.user.role === 'manager') {
      query = query.eq('manager_id', authResult.user.profileId)
    }

    const { data, error } = await query.select('*').single()
    if (error) {
      throw error
    }

    return NextResponse.json({
      employee: {
        id: data.id,
        uid: data.auth_user_id,
        email: data.email || '',
        firstName: data.first_name || '',
        lastName: data.last_name || '',
        role: data.role || 'employee',
        department: data.department || '',
        position: data.position || '',
        salary: Number(data.salary || 0),
        managerId: data.manager_id || null,
        status: data.status || 'active',
        hasPassword: data.has_password || false,
        hireDate: data.hire_date ? new Date(data.hire_date) : new Date(),
        createdAt: data.created_at ? new Date(data.created_at) : new Date(),
        updatedAt: data.updated_at ? new Date(data.updated_at) : new Date(),
        mobileNumber: data.mobile_number || null,
        bankAccount: data.bank_account || null,
        address: data.address || null,
        emergencyContact: data.emergency_contact || null,
        documents: data.documents || []
      }
    })
  } catch (error) {
    console.error('Error in PUT /api/employees:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const authResult = await authenticateRequest(request)
    if (authResult.error || !authResult.user) {
      return authResult.error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (authResult.user.role !== 'admin' && authResult.user.role !== 'manager') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = String(searchParams.get('id') || '').trim()
    if (!id) {
      return NextResponse.json({ error: 'Employee id is required' }, { status: 400 })
    }

    let deleteQuery = supabaseAdmin.from('profiles').delete().eq('id', id)
    if (authResult.user.role === 'manager') {
      deleteQuery = deleteQuery.eq('manager_id', authResult.user.profileId)
    }

    const { error } = await deleteQuery
    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/employees:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}