#!/usr/bin/env node

/**
 * Firestore -> Supabase migration utility.
 *
 * Usage:
 *   node migrate-to-supabase.js
 *
 * Required env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   FIREBASE_ADMIN_PROJECT_ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY
 */

let admin
try {
  admin = require('firebase-admin')
} catch (_error) {
  throw new Error(
    'Legacy Firestore migration script requires firebase-admin. ' +
    'Install it temporarily only if you need to rerun historical Firestore backfill.'
  )
}
const { createClient } = require('@supabase/supabase-js')

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function requireAnyEnv(names) {
  for (const name of names) {
    const value = process.env[name]
    if (value) return value
  }
  throw new Error(`Missing required environment variable. Expected one of: ${names.join(', ')}`)
}

function toIso(value) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  if (value && typeof value.toDate === 'function') return value.toDate().toISOString()
  return value
}

function normalize(value) {
  if (value == null) return value
  if (Array.isArray(value)) return value.map(normalize)
  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      return value.toDate().toISOString()
    }
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = normalize(v)
    return out
  }
  return value
}

async function listAllAuthUsers(supabase) {
  const usersByEmail = new Map()
  let page = 1
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    for (const user of data.users || []) {
      if (user.email) usersByEmail.set(user.email.toLowerCase(), user.id)
    }
    if (!data.users || data.users.length < 1000) break
    page += 1
  }
  return usersByEmail
}

// Tracks auth user ids that were freshly provisioned by *this* run so that we
// can flag their profiles as needing first-time password setup. Without this
// flag the user lands on the login screen, types their old Firebase password,
// gets "Invalid login credentials", and has no way to recover on their own.
const provisionedAuthUserIds = new Set()

async function getOrCreateAuthUserId(supabase, usersByEmail, email) {
  const normalizedEmail = (email || '').toLowerCase()
  if (!normalizedEmail) return null

  const existing = usersByEmail.get(normalizedEmail)
  if (existing) return existing

  // A throwaway password the user can never know. They will be forced through
  // the first-time-password flow which calls supabase.auth.admin.updateUserById
  // to replace this value with the password they choose.
  const placeholderPassword =
    process.env.MIGRATION_DEFAULT_PASSWORD ||
    `migrated-${normalizedEmail}-${Date.now()}-${Math.random().toString(36).slice(2)}!Aa1`

  const { data, error } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password: placeholderPassword,
    email_confirm: true,
    user_metadata: {
      migrated_from: 'firestore',
      requires_password_setup: true
    }
  })

  if (error || !data?.user?.id) {
    console.error(`Failed to create auth user for ${normalizedEmail}:`, error?.message || 'unknown error')
    return null
  }

  usersByEmail.set(normalizedEmail, data.user.id)
  provisionedAuthUserIds.add(data.user.id)
  return data.user.id
}

async function run() {
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceRole = requireAnyEnv(['SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY'])
  const projectId = requireEnv('FIREBASE_ADMIN_PROJECT_ID')
  const clientEmail = requireEnv('FIREBASE_ADMIN_CLIENT_EMAIL')
  const privateKey = requireEnv('FIREBASE_ADMIN_PRIVATE_KEY')

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n')
      })
    })
  }

  const db = admin.firestore()
  const usersByEmail = await listAllAuthUsers(supabase)
  const profileMap = new Map() // legacy id/uid -> profile UUID

  console.log(`Loaded ${usersByEmail.size} auth users from Supabase`)

  // 1) Migrate users/managers/employees into profiles
  for (const sourceCollection of ['users', 'managers', 'employees']) {
    const snapshot = await db.collection(sourceCollection).get()
    console.log(`Migrating ${snapshot.size} docs from ${sourceCollection} -> profiles`)

    for (const doc of snapshot.docs) {
      const row = normalize(doc.data())
      const email = (row.email || '').toLowerCase()
      const authUserId = await getOrCreateAuthUserId(supabase, usersByEmail, email)

      if (!email || !authUserId) {
        // Keep full fidelity for manual remediation
        await supabase.from('legacy_firestore_dump').upsert({
          collection_name: sourceCollection,
          legacy_document_id: doc.id,
          payload: row
        }, { onConflict: 'collection_name,legacy_document_id' })
        continue
      }

      // Profiles whose auth user was provisioned by this script have a
      // placeholder password the user does not know, so they must be sent
      // through the first-time-password setup flow on next login.
      const wasJustProvisioned = provisionedAuthUserIds.has(authUserId)
      const hasPassword = wasJustProvisioned ? false : (row.hasPassword ?? true)
      const requiresPasswordChange = wasJustProvisioned
        ? true
        : (row.requiresPasswordChange ?? false)

      const payload = {
        auth_user_id: authUserId,
        email,
        role: row.role || (sourceCollection === 'users' ? 'admin' : sourceCollection === 'managers' ? 'manager' : 'employee'),
        first_name: row.firstName || '',
        last_name: row.lastName || '',
        department: row.department || null,
        position: row.position || null,
        phone: row.phone || null,
        mobile_number: row.mobileNumber || null,
        status: row.status || 'active',
        has_password: hasPassword,
        requires_password_change: requiresPasswordChange,
        hire_date: row.hireDate ? String(row.hireDate).slice(0, 10) : null,
        salary: typeof row.salary === 'number' ? row.salary : null,
        bank_account: row.bankAccount || null,
        address: row.address || null,
        emergency_contact: row.emergencyContact || null,
        documents: row.documents || [],
        metadata: {
          source_collection: sourceCollection,
          legacy_document_id: doc.id,
          legacy_uid: row.uid || null
        },
        created_at: toIso(row.createdAt) || new Date().toISOString(),
        updated_at: toIso(row.updatedAt) || new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('profiles')
        .upsert(payload, { onConflict: 'auth_user_id' })
        .select('id')
        .single()

      if (error) {
        console.error(`Failed to upsert profile for ${email}:`, error.message)
        continue
      }

      profileMap.set(doc.id, data.id)
      if (row.uid) profileMap.set(String(row.uid), data.id)
      profileMap.set(email, data.id)
    }
  }

  // 2) Migrate high-priority collections to structured tables
  const attendanceSnap = await db.collection('attendance').get()
  console.log(`Migrating ${attendanceSnap.size} attendance docs`)
  for (const doc of attendanceSnap.docs) {
    const row = normalize(doc.data())
    const employeeId = profileMap.get(row.employeeId) || profileMap.get(row.userId) || null
    if (!employeeId) {
      await supabase.from('legacy_firestore_dump').upsert({
        collection_name: 'attendance',
        legacy_document_id: doc.id,
        payload: row
      }, { onConflict: 'collection_name,legacy_document_id' })
      continue
    }
    await supabase.from('attendance_records').upsert({
      employee_id: employeeId,
      manager_id: profileMap.get(row.managerId) || null,
      date: row.date ? String(row.date).slice(0, 10) : new Date().toISOString().slice(0, 10),
      status: row.status || 'present',
      check_in_time: toIso(row.checkIn?.time),
      check_out_time: toIso(row.checkOut?.time),
      check_in_location: row.checkIn?.location || null,
      check_out_location: row.checkOut?.location || null,
      check_in_device: row.checkIn?.deviceInfo || null,
      check_out_device: row.checkOut?.deviceInfo || null,
      approval_status: row.approvalStatus || 'pending',
      notes: row.notes || null,
      flags: row.flags || [],
      created_at: toIso(row.createdAt) || new Date().toISOString(),
      updated_at: toIso(row.updatedAt) || new Date().toISOString()
    })
  }

  const taskSnap = await db.collection('tasks').get()
  console.log(`Migrating ${taskSnap.size} task docs`)
  for (const doc of taskSnap.docs) {
    const row = normalize(doc.data())
    const { data: existingTask } = await supabase
      .from('tasks')
      .select('id')
      .contains('metadata', { legacy_task_id: doc.id })
      .maybeSingle()

    let taskId = existingTask?.id || null
    if (!taskId) {
      const { data: task, error: taskError } = await supabase.from('tasks').insert({
        title: row.title || 'Untitled task',
        description: row.description || null,
        assigner_id: profileMap.get(row.assignerId) || null,
        department: row.department || null,
        priority: row.priority || 'medium',
        status: row.status || 'backlog',
        category: row.category || 'general',
        due_date: toIso(row.dueDate),
        completed_at: toIso(row.completedAt),
        estimated_hours: row.estimatedHours || null,
        actual_hours: row.actualHours || null,
        progress: row.progress || null,
        tags: row.tags || [],
        dependencies: row.dependencies || [],
        metadata: { legacy_task_id: doc.id, ...row.metadata },
        created_at: toIso(row.createdAt) || new Date().toISOString(),
        updated_at: toIso(row.updatedAt) || new Date().toISOString()
      }).select('id').single()

      if (taskError || !task) {
        await supabase.from('legacy_firestore_dump').upsert({
          collection_name: 'tasks',
          legacy_document_id: doc.id,
          payload: row
        }, { onConflict: 'collection_name,legacy_document_id' })
        continue
      }
      taskId = task.id
    }

    if (!taskId) {
      await supabase.from('legacy_firestore_dump').upsert({
        collection_name: 'tasks',
        legacy_document_id: doc.id,
        payload: row
      }, { onConflict: 'collection_name,legacy_document_id' })
      continue
    }

    for (const assignee of row.assignees || []) {
      const profileId = profileMap.get(assignee.id)
      if (!profileId) continue
      await supabase.from('task_assignees').upsert({
        task_id: taskId,
        assignee_id: profileId,
        assignment_type: assignee.type || 'user'
      }, { onConflict: 'task_id,assignee_id' })
    }
  }

  const payrollSnap = await db.collection('payrollEntries').get()
  console.log(`Migrating ${payrollSnap.size} payroll entries`)
  for (const doc of payrollSnap.docs) {
    const row = normalize(doc.data())
    const employeeId = profileMap.get(row.employeeId) || null
    if (!employeeId) {
      await supabase.from('legacy_firestore_dump').upsert({
        collection_name: 'payrollEntries',
        legacy_document_id: doc.id,
        payload: row
      }, { onConflict: 'collection_name,legacy_document_id' })
      continue
    }
    await supabase.from('payroll_entries').insert({
      employee_id: employeeId,
      period_month: row.month || new Date().toISOString().slice(0, 7),
      basic_salary: row.basicSalary || row.baseSalary || 0,
      gross_salary: row.grossSalary || 0,
      net_salary: row.netSalary || row.netPay || 0,
      allowances: row.allowances || [],
      deductions: row.deductions || [],
      overtime_hours: row.overtimeHours || 0,
      overtime_rate: row.overtimeRate || 1,
      bonus: row.bonus || 0,
      status: row.status || 'pending',
      payment_date: toIso(row.paymentDate),
      payment_method: row.paymentMethod || null,
      payment: row.payment || {},
      notes: row.notes || null,
      created_at: toIso(row.createdAt) || new Date().toISOString(),
      updated_at: toIso(row.updatedAt) || new Date().toISOString()
    })
  }

  // 3) Everything else goes to legacy dump for manual reconciliation
  const structured = new Set(['users', 'managers', 'employees', 'attendance', 'tasks', 'payrollEntries'])
  const allCollections = await db.listCollections()
  for (const col of allCollections) {
    if (structured.has(col.id)) continue
    const snap = await col.get()
    console.log(`Archiving ${snap.size} docs from ${col.id} -> legacy_firestore_dump`)
    for (const doc of snap.docs) {
      await supabase.from('legacy_firestore_dump').upsert({
        collection_name: col.id,
        legacy_document_id: doc.id,
        payload: normalize(doc.data())
      }, { onConflict: 'collection_name,legacy_document_id' })
    }
  }

  console.log('Migration complete')
}

run().catch((error) => {
  console.error('Migration failed:', error)
  process.exit(1)
})

