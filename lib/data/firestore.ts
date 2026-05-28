/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import { supabaseClient as supabase } from '@/lib/supabase/client'
import { getCachedIdentity, getCurrentIdentity } from './identity'

type QueryConstraint =
  | { kind: 'where'; field: string; op: string; value: unknown }
  | { kind: 'orderBy'; field: string; direction: 'asc' | 'desc' }
  | { kind: 'limit'; count: number }
  | { kind: 'startAfter'; cursor: SnapshotDoc }
  | { kind: 'and'; constraints: QueryConstraint[] }

type CollectionRef = { kind: 'collection'; collection: string }
type QueryRef = { kind: 'query'; collection: string; constraints: QueryConstraint[] }
type DocRef = { kind: 'doc'; collection: string; id: string }

type SnapshotDoc = {
  id: string
  ref: DocRef
  data: () => Record<string, any>
  exists: () => boolean
}

type DocChange = {
  type: 'added' | 'modified' | 'removed'
  doc: SnapshotDoc
}

type QuerySnapshot = {
  docs: SnapshotDoc[]
  empty: boolean
  size: number
  docChanges: () => DocChange[]
  forEach: (callback: (doc: SnapshotDoc, index?: number) => void) => void
}

export type QueryDocumentSnapshot = SnapshotDoc
export type DocumentData = Record<string, any>

const dbInstance = { kind: 'db' as const }

const COLLECTION_TABLE_MAP: Record<string, string> = {
  users: 'profiles',
  employees: 'profiles',
  managers: 'profiles',
  attendance: 'attendance_records',
  attendance_records: 'attendance_records',
  tasks: 'tasks',
  payrollEntries: 'payroll_entries',
  payroll_entries: 'payroll_entries',
  payroll: 'payroll_entries',
  notifications: 'notifications',
  projects: 'tasks',
  documents: 'documents',
  auditLogs: 'audit_logs',
  audit_logs: 'audit_logs',
  leaveRequests: 'leave_requests',
  leave_requests: 'leave_requests',
  leaveBalances: 'leave_balances',
  leave_balances: 'leave_balances',
  focusSessions: 'focus_sessions',
  focus_sessions: 'focus_sessions',
  meetings: 'meetings',
  performance_reviews: 'performance_reviews',
  performanceReviews: 'performance_reviews',
  kpis: 'kpis',
  kpi_scores: 'kpi_scores',
  kpiScores: 'kpi_scores',
  feedback_360: 'feedback_360',
  feedback360: 'feedback_360',
  goals: 'goals',
  salary_reviews: 'salary_reviews',
  salaryReviews: 'salary_reviews',
  self_assessments: 'self_assessments',
  selfAssessments: 'self_assessments',
  feedback_criteria: 'feedback_criteria',
  feedbackCriteria: 'feedback_criteria',
  departments: 'departments',
  productivity: 'productivity_records',
  productivity_records: 'productivity_records',
  unified_metrics: 'productivity_records',
  unifiedMetrics: 'productivity_records',
  settings: 'app_settings',
  app_settings: 'app_settings',
  officeLocations: 'office_locations',
  office_locations: 'office_locations',
  monitoring: 'monitoring_events',
  monitoring_events: 'monitoring_events'
}

const PROFILE_COLLECTION_ROLE_FILTER: Record<string, string | null> = {
  users: null,
  employees: 'employee',
  managers: 'manager'
}

/** Firestore-style field name -> Postgres column name (per table). */
const TABLE_FIELD_TO_DB: Record<string, Record<string, string>> = {
  notifications: {
    employeeId: 'user_id',
    employee_id: 'user_id',
    userId: 'user_id',
    user_id: 'user_id'
  },
  focus_sessions: {
    userId: 'user_id',
    employeeId: 'user_id'
  },
  meetings: {
    userId: 'user_id',
    employeeId: 'user_id',
    organizer: 'user_id'
  },
  performance_reviews: {
    feedback360: 'feedback_360'
  },
  payroll_entries: {
    processedAt: 'updated_at',
    employeeName: 'employee_name',
    grossSalary: 'gross_salary',
    netSalary: 'net_salary',
    basicSalary: 'basic_salary',
    employeeId: 'employee_id',
    departmentId: 'department_id',
    period: 'period_month',
    periodId: 'period_month'
  },
  attendance_records: {
    employeeId: 'employee_id',
    managerId: 'manager_id',
    approvalStatus: 'approval_status',
    approvedBy: 'approved_by',
    approvedAt: 'approved_at',
    totalHours: 'total_hours',
    activeTime: 'active_time_minutes',
    idleTimeTotal: 'idle_time_minutes'
  },
  departments: {
    managerId: 'manager_profile_id',
    manager_id: 'manager_profile_id',
    managerProfileId: 'manager_profile_id'
  },
  office_locations: {
    isActive: 'is_active',
    workingHours: 'working_hours'
  },
  tasks: {
    assignerId: 'assigner_id',
    dueDate: 'due_date',
    completedAt: 'completed_at',
    estimatedHours: 'estimated_hours',
    actualHours: 'actual_hours',
    projectId: 'project_id'
  },
  leave_requests: {
    employeeId: 'employee_id',
    managerId: 'manager_id',
    startDate: 'start_date',
    endDate: 'end_date',
    approvedBy: 'approved_by',
    approvedAt: 'approved_at',
    rejectedBy: 'rejected_by',
    rejectedAt: 'rejected_at'
  },
  documents: {
    ownerId: 'owner_id',
    employeeId: 'employee_id',
    storagePath: 'storage_path',
    storageBucket: 'storage_bucket',
    sizeBytes: 'size_bytes'
  },
  productivity_records: {
    userId: 'user_id',
    productivityScore: 'productivity_score',
    totalFocusTime: 'focus_time_minutes',
    totalMeetingTime: 'meeting_time_minutes',
    taskCompletionRate: 'task_completion_rate'
  }
}

/** Postgres column name -> Firestore-style field name (per table). */
const TABLE_FIELD_FROM_DB: Record<string, Record<string, string>> = {
  notifications: {
    user_id: 'employeeId'
  },
  focus_sessions: {
    user_id: 'userId'
  },
  meetings: {
    user_id: 'userId'
  },
  documents: {
    owner_id: 'ownerId',
    employee_id: 'employeeId'
  },
  payroll_entries: {
    updated_at: 'processedAt',
    period_month: 'period',
    gross_salary: 'grossSalary',
    net_salary: 'netSalary',
    basic_salary: 'basicSalary',
    employee_id: 'employeeId'
  },
  productivity_records: {
    user_id: 'userId',
    productivity_score: 'productivityScore',
    focus_time_minutes: 'totalFocusTime',
    meeting_time_minutes: 'totalMeetingTime',
    task_completion_rate: 'taskCompletionRate'
  }
}

function tableForCollection(collection: string): string {
  return COLLECTION_TABLE_MAP[collection] || collection
}

function toDbField(table: string, field: string): string {
  const snake = toSnakeCase(field)
  const mapped = TABLE_FIELD_TO_DB[table]?.[field] ?? TABLE_FIELD_TO_DB[table]?.[snake]
  if (mapped) return mapped
  if (table === 'profiles' && (field === 'uid' || snake === 'uid')) {
    return 'auth_user_id'
  }
  if (table === 'notifications' && (field === 'employeeId' || snake === 'employee_id')) {
    return 'user_id'
  }
  if (table === 'payroll_entries') {
    if (field === 'period' || snake === 'period' || field === 'periodId' || snake === 'period_id') {
      return 'period_month'
    }
    if (field === 'processedAt' || snake === 'processed_at') {
      return 'updated_at'
    }
  }
  return snake
}

function applyFromDbFieldAliases(table: string, converted: Record<string, any>, raw: Record<string, any>) {
  const aliases = TABLE_FIELD_FROM_DB[table]
  if (!aliases) return
  for (const [dbKey, appKey] of Object.entries(aliases)) {
    if (raw[dbKey] !== undefined && raw[dbKey] !== null) {
      converted[appKey] = raw[dbKey]
    }
  }
}

function normalizeQueryValue(value: unknown, dbField: string): unknown {
  if (value instanceof Timestamp) {
    value = value.toDate()
  }
  if (value instanceof Date) {
    if (dbField === 'date') {
      return value.toISOString().slice(0, 10)
    }
    return value.toISOString()
  }
  return value
}

function toSnakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase()
}

function toCamelCase(value: string): string {
  return value.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

function isDateField(camelKey: string): boolean {
  return camelKey === 'date' || camelKey.endsWith('At') || camelKey.endsWith('Time')
}

function wrapDateValue(value: unknown): Timestamp {
  if (value instanceof Timestamp) return value
  if (value instanceof Date) return Timestamp.fromDate(value)
  if (typeof value === 'string') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return Timestamp.fromDate(parsed)
  }
  return Timestamp.fromDate(new Date())
}

function convertRecordFromDb(record: Record<string, any>, table?: string): Record<string, any> {
  const converted: Record<string, any> = {}
  for (const [key, raw] of Object.entries(record)) {
    const camelKey = toCamelCase(key)
    let value = raw
    if (isDateField(camelKey) && raw != null) {
      value = wrapDateValue(raw)
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      value = convertRecordFromDb(value as Record<string, any>, table)
    }
    converted[camelKey] = value
  }

  if (record.auth_user_id && !converted.uid) {
    converted.uid = record.auth_user_id
  }
  if (record.avatar_url && !converted.photoURL) {
    converted.photoURL = record.avatar_url
  }
  if (record.id && !converted.id) {
    converted.id = record.id
  }

  if (table) {
    applyFromDbFieldAliases(table, converted, record)
  }

  if (table === 'payroll_entries') {
    if (converted.processedAt == null && converted.updatedAt != null) {
      converted.processedAt = converted.updatedAt
    }
    if (converted.period == null && record.period_month != null) {
      converted.period = record.period_month
    }
    const payment = (record.payment ?? {}) as Record<string, unknown>
    if (payment.employeeName && !converted.employeeName) {
      converted.employeeName = payment.employeeName
    }
    if (payment.department && !converted.department) {
      converted.department = payment.department
    }
  }

  if (table === 'attendance_records') {
    nestAttendanceFromDb(converted, record)
  }

  if (table && TABLES_WITH_METADATA_STASH.has(table)) {
    const metadata = converted.metadata
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
      for (const [metaKey, metaValue] of Object.entries(metadata)) {
        if (converted[metaKey] === undefined) {
          converted[metaKey] = metaValue
        }
      }
    }
  }

  if (table === 'office_locations') {
    if (converted.latitude != null || converted.longitude != null) {
      converted.coordinates = {
        lat: typeof converted.latitude === 'string' ? Number(converted.latitude) : converted.latitude,
        lng: typeof converted.longitude === 'string' ? Number(converted.longitude) : converted.longitude
      }
    }
    // Legacy callsites read `region`; surface `country` under that key too.
    if (converted.region == null && converted.country != null) {
      converted.region = converted.country
    }
  }

  if (table === 'departments') {
    if (converted.managerProfileId != null && converted.managerId == null) {
      converted.managerId = converted.managerProfileId
    }
  }

  return converted
}

/** Flatten nested checkIn/checkOut objects into columns expected by attendance_records. */
function flattenAttendanceForDb(record: Record<string, any>): Record<string, any> {
  const flat: Record<string, any> = { ...record }

  const checkIn = flat.checkIn ?? flat.check_in
  if (checkIn && typeof checkIn === 'object' && !Array.isArray(checkIn)) {
    const ci = checkIn as Record<string, any>
    if (ci.time != null) flat.checkInTime = ci.time
    if (ci.location != null) flat.checkInLocation = ci.location
    if (ci.deviceInfo != null) flat.checkInDevice = ci.deviceInfo
    delete flat.checkIn
    delete flat.check_in
  }

  const checkOut = flat.checkOut ?? flat.check_out
  if (checkOut && typeof checkOut === 'object' && !Array.isArray(checkOut)) {
    const co = checkOut as Record<string, any>
    if (co.time != null) flat.checkOutTime = co.time
    if (co.location != null) flat.checkOutLocation = co.location
    if (co.deviceInfo != null) flat.checkOutDevice = co.deviceInfo
    delete flat.checkOut
    delete flat.check_out
  }

  return flat
}

function nestAttendanceFromDb(converted: Record<string, any>, raw: Record<string, any>) {
  const checkInTime = converted.checkInTime ?? raw.check_in_time
  const checkInLocation = converted.checkInLocation ?? raw.check_in_location
  const checkInDevice = converted.checkInDevice ?? raw.check_in_device

  if (checkInTime != null || checkInLocation != null || checkInDevice != null) {
    converted.checkIn = {
      ...(checkInTime != null ? { time: wrapDateValue(checkInTime) } : {}),
      ...(checkInLocation != null ? { location: checkInLocation } : {}),
      ...(checkInDevice != null ? { deviceInfo: checkInDevice } : {}),
    }
    delete converted.checkInTime
    delete converted.checkInLocation
    delete converted.checkInDevice
  }

  const checkOutTime = converted.checkOutTime ?? raw.check_out_time
  const checkOutLocation = converted.checkOutLocation ?? raw.check_out_location
  const checkOutDevice = converted.checkOutDevice ?? raw.check_out_device

  if (checkOutTime != null || checkOutLocation != null || checkOutDevice != null) {
    converted.checkOut = {
      ...(checkOutTime != null ? { time: wrapDateValue(checkOutTime) } : {}),
      ...(checkOutLocation != null ? { location: checkOutLocation } : {}),
      ...(checkOutDevice != null ? { deviceInfo: checkOutDevice } : {}),
    }
    delete converted.checkOutTime
    delete converted.checkOutLocation
    delete converted.checkOutDevice
  }
}

const PAYROLL_ENTRIES_COLUMNS = new Set([
  'id',
  'employee_id',
  'department_id',
  'period_month',
  'basic_salary',
  'gross_salary',
  'net_salary',
  'allowances',
  'deductions',
  'overtime_hours',
  'overtime_rate',
  'bonus',
  'status',
  'payment_date',
  'payment_method',
  'payment',
  'notes',
  'created_at',
  'updated_at'
])

const ATTENDANCE_RECORDS_COLUMNS = new Set([
  'id',
  'employee_id',
  'employee_name',
  'department',
  'manager_id',
  'date',
  'status',
  'check_in_time',
  'check_out_time',
  'check_in_location',
  'check_out_location',
  'check_in_device',
  'check_out_device',
  'idle_time_minutes',
  'total_hours',
  'active_time_minutes',
  'approval_status',
  'approved_by',
  'approved_at',
  'notes',
  'flags',
  'created_at',
  'updated_at'
])

const TASKS_COLUMNS = new Set([
  'id',
  'title',
  'description',
  'assigner_id',
  'department',
  'priority',
  'status',
  'category',
  'due_date',
  'completed_at',
  'estimated_hours',
  'actual_hours',
  'progress',
  'project_id',
  'tags',
  'dependencies',
  'metadata',
  'created_at',
  'updated_at'
])

const DOCUMENTS_COLUMNS = new Set([
  'id',
  'owner_id',
  'employee_id',
  'name',
  'type',
  'category',
  'storage_path',
  'storage_bucket',
  'size_bytes',
  'metadata',
  'created_at',
  'updated_at'
])

const LEAVE_REQUESTS_COLUMNS = new Set([
  'id',
  'employee_id',
  'manager_id',
  'type',
  'start_date',
  'end_date',
  'status',
  'reason',
  'attachments',
  'approved_by',
  'approved_at',
  'rejected_by',
  'rejected_at',
  'created_at',
  'updated_at'
])

const OFFICE_LOCATIONS_COLUMNS = new Set([
  'id',
  'name',
  'address',
  'city',
  'country',
  'latitude',
  'longitude',
  'radius',
  'working_hours',
  'is_active',
  'created_at',
  'updated_at'
])

const DEPARTMENTS_COLUMNS = new Set([
  'id',
  'name',
  'description',
  'manager_profile_id',
  'created_at',
  'updated_at'
])

const PRODUCTIVITY_RECORDS_COLUMNS = new Set([
  'id',
  'user_id',
  'date',
  'productivity_score',
  'focus_time_minutes',
  'meeting_time_minutes',
  'task_completion_rate',
  'metadata',
  'created_at',
  'updated_at'
])

/** jsonb columns queried with Firestore-style array-contains */
const JSONB_ARRAY_CONTAINS_COLUMNS: Record<string, Set<string>> = {
  meetings: new Set(['participants', 'tags', 'outcomes']),
  focus_sessions: new Set(['tags']),
  tasks: new Set(['tags', 'dependencies']),
  attendance_records: new Set(['flags'])
}

const TABLE_COLUMN_ALLOWLIST: Record<string, Set<string>> = {
  tasks: TASKS_COLUMNS,
  documents: DOCUMENTS_COLUMNS,
  leave_requests: LEAVE_REQUESTS_COLUMNS,
  office_locations: OFFICE_LOCATIONS_COLUMNS,
  departments: DEPARTMENTS_COLUMNS,
  attendance_records: ATTENDANCE_RECORDS_COLUMNS,
  payroll_entries: PAYROLL_ENTRIES_COLUMNS,
  productivity_records: PRODUCTIVITY_RECORDS_COLUMNS
}

const TABLES_WITH_METADATA_STASH = new Set(['tasks', 'documents', 'productivity_records'])

/**
 * For each table, the set of database columns that hold a `profiles.id` (i.e.
 * FK references to public.profiles). Legacy callsites often pass the current
 * Supabase auth user id (`auth.users.id`) into these slots — we translate
 * that value to the matching profile id at the shim boundary.
 */
const PROFILE_FK_COLUMNS_BY_TABLE: Record<string, Set<string>> = {
  attendance_records: new Set(['employee_id', 'manager_id', 'approved_by']),
  leave_requests: new Set([
    'employee_id',
    'manager_id',
    'approved_by',
    'rejected_by'
  ]),
  leave_balances: new Set(['employee_id']),
  tasks: new Set(['assigner_id']),
  task_assignees: new Set(['assignee_id']),
  task_records: new Set(['user_id']),
  productivity_records: new Set(['user_id']),
  focus_sessions: new Set(['user_id']),
  meetings: new Set(['user_id']),
  kpis: new Set(['created_by']),
  performance_reviews: new Set([
    'employee_id',
    'reviewer_id',
    'hr_approved_by'
  ]),
  kpi_scores: new Set(['employee_id']),
  goals: new Set(['employee_id', 'created_by']),
  feedback_360: new Set(['employee_id', 'provider_id']),
  salary_reviews: new Set(['employee_id']),
  self_assessments: new Set(['employee_id']),
  payroll_entries: new Set(['employee_id']),
  notifications: new Set(['user_id']),
  documents: new Set(['owner_id', 'employee_id']),
  audit_logs: new Set(['actor_id']),
  monitoring_events: new Set(['employee_id']),
  app_settings: new Set(['created_by', 'updated_by']),
  departments: new Set(['manager_profile_id']),
  profiles: new Set(['manager_id'])
}

function isProfileFkColumn(table: string, dbField: string): boolean {
  return PROFILE_FK_COLUMNS_BY_TABLE[table]?.has(dbField) ?? false
}

/**
 * If `value` looks like the currently logged-in Supabase auth user id and the
 * destination column expects a profiles.id, swap it for the matching profile
 * id. This is a best-effort, cached translation: it only applies to the
 * current user. Other callsites that pass `user.id` (= profile id) directly
 * are not affected.
 */
function maybeNormalizeProfileIdValue(table: string, dbField: string, value: unknown): unknown {
  if (!isProfileFkColumn(table, dbField)) return value
  const identity = getCachedIdentity()
  if (!identity) return value
  if (typeof value === 'string' && value === identity.authUid) {
    return identity.profileId
  }
  if (Array.isArray(value)) {
    return value.map((entry) =>
      typeof entry === 'string' && entry === identity.authUid
        ? identity.profileId
        : entry
    )
  }
  return value
}

/** Flatten { coordinates: { lat, lng } } into top-level latitude/longitude. */
function flattenOfficeLocationForDb(record: Record<string, any>): Record<string, any> {
  const flat: Record<string, any> = { ...record }
  const coordinates =
    flat.coordinates ?? flat.coords ?? flat.location ?? flat.geo
  if (coordinates && typeof coordinates === 'object' && !Array.isArray(coordinates)) {
    const c = coordinates as Record<string, any>
    if (typeof c.latitude === 'number') flat.latitude = c.latitude
    else if (typeof c.lat === 'number') flat.latitude = c.lat
    if (typeof c.longitude === 'number') flat.longitude = c.longitude
    else if (typeof c.lng === 'number') flat.longitude = c.lng
    delete flat.coordinates
    delete flat.coords
  }
  // Legacy form uses `region` to mean "country" or arbitrary admin region;
  // schema only has `country`, so map it through if `country` isn't set.
  if (flat.region != null && flat.country == null) {
    flat.country = flat.region
  }
  delete flat.region
  return flat
}

function convertRecordToDb(record: Record<string, any>, table?: string): Record<string, any> {
  const converted: Record<string, any> = {}
  const paymentExtras: Record<string, any> =
    table === 'payroll_entries' && record.payment && typeof record.payment === 'object'
      ? { ...(record.payment as Record<string, any>) }
      : {}
  const metadataExtras: Record<string, any> = {}

  if (table === 'attendance_records') {
    record = flattenAttendanceForDb(record)
  } else if (table === 'office_locations') {
    record = flattenOfficeLocationForDb(record)
  }

  const allowlist = table ? TABLE_COLUMN_ALLOWLIST[table] : undefined
  const stashIntoMetadata = table ? TABLES_WITH_METADATA_STASH.has(table) : false

  for (const [key, raw] of Object.entries(record)) {
    if (raw === undefined) continue
    // Skip Firestore-only sentinel values
    if (raw && typeof raw === 'object' && '__op' in (raw as Record<string, unknown>)) {
      continue
    }
    const dbKey = table ? toDbField(table, key) : toSnakeCase(key)
    let value = raw
    if (value instanceof Timestamp) {
      const asDate = value.toDate()
      value = dbKey === 'date' ? asDate.toISOString().slice(0, 10) : asDate.toISOString()
    } else if (value instanceof Date) {
      value = dbKey === 'date' ? value.toISOString().slice(0, 10) : value.toISOString()
    } else if (value && typeof value === 'object' && !Array.isArray(value) && !('__op' in (value as Record<string, any>))) {
      value = convertRecordToDb(value as Record<string, any>, table)
    }

    if (table === 'payroll_entries') {
      if (dbKey === 'employee_name') {
        paymentExtras.employeeName = value
        continue
      }
      if (dbKey === 'department' && typeof value === 'string') {
        paymentExtras.department = value
        continue
      }
      if (dbKey === 'processed_by') {
        paymentExtras.processedBy = value
        continue
      }
      if (!PAYROLL_ENTRIES_COLUMNS.has(dbKey)) {
        paymentExtras[key] = value
        continue
      }
      if (dbKey === 'allowances' || dbKey === 'deductions') {
        if (typeof value === 'number') {
          value = [{ name: dbKey === 'allowances' ? 'allowance' : 'deduction', amount: value }]
        }
      }
    }

    if (table === 'attendance_records' && !ATTENDANCE_RECORDS_COLUMNS.has(dbKey)) {
      continue
    }

    if (allowlist && !allowlist.has(dbKey) && table !== 'payroll_entries' && table !== 'attendance_records') {
      // Out-of-schema field. Either stash it under metadata or drop it.
      if (stashIntoMetadata && dbKey !== 'metadata') {
        metadataExtras[key] = value
      }
      continue
    }

    if (isProfileFkColumn(table || '', dbKey)) {
      value = maybeNormalizeProfileIdValue(table || '', dbKey, value)
    }

    converted[dbKey] = value
  }

  if (table === 'payroll_entries' && Object.keys(paymentExtras).length > 0) {
    converted.payment = {
      ...(typeof converted.payment === 'object' && converted.payment ? converted.payment : {}),
      ...paymentExtras
    }
  }

  if (stashIntoMetadata && Object.keys(metadataExtras).length > 0) {
    const existingMetadata =
      typeof converted.metadata === 'object' && converted.metadata && !Array.isArray(converted.metadata)
        ? (converted.metadata as Record<string, any>)
        : {}
    converted.metadata = { ...existingMetadata, ...metadataExtras }
  }

  return converted
}

function normalizeProfileRoleFilter(collection: string): QueryConstraint[] {
  const role = PROFILE_COLLECTION_ROLE_FILTER[collection]
  if (role === undefined) return []
  if (role === null) {
    return [{ kind: 'where', field: 'role', op: 'in', value: ['admin', 'manager'] }]
  }
  return [{ kind: 'where', field: 'role', op: '==', value: role }]
}

function flattenConstraints(constraints: QueryConstraint[]): QueryConstraint[] {
  return constraints.flatMap((constraint) => {
    if (constraint.kind === 'and') {
      return flattenConstraints(constraint.constraints)
    }
    return [constraint]
  })
}

function applyWhereClause(builder: any, table: string, field: string, op: string, value: unknown) {
  let dbField = toDbField(table, field)
  if (table === 'notifications' && dbField === 'employee_id') {
    dbField = 'user_id'
  }
  let inputValue = value
  if (isProfileFkColumn(table, dbField)) {
    inputValue = maybeNormalizeProfileIdValue(table, dbField, inputValue)
  }
  const normalizedValue = normalizeQueryValue(inputValue, dbField)
  switch (op) {
    case '==':
      return builder.eq(dbField, normalizedValue)
    case '!=':
      return builder.neq(dbField, normalizedValue)
    case '>':
      return builder.gt(dbField, normalizedValue)
    case '>=':
      return builder.gte(dbField, normalizedValue)
    case '<':
      return builder.lt(dbField, normalizedValue)
    case '<=':
      return builder.lte(dbField, normalizedValue)
    case 'in':
      return builder.in(
        dbField,
        (Array.isArray(normalizedValue) ? normalizedValue : [normalizedValue]).map((item) =>
          normalizeQueryValue(item, dbField)
        )
      )
    case 'array-contains': {
      const scalar = Array.isArray(normalizedValue) ? normalizedValue[0] : normalizedValue
      if (scalar === undefined || scalar === null) {
        return builder
      }
      // PostgREST jsonb @> expects a JSON document; passing a JS array can produce
      // "invalid input syntax for type json" depending on client encoding.
      if (JSONB_ARRAY_CONTAINS_COLUMNS[table]?.has(dbField)) {
        return builder.contains(dbField, JSON.stringify([scalar]))
      }
      return builder.contains(dbField, [scalar])
    }
    default:
      return builder.eq(dbField, normalizedValue)
  }
}

async function runQuery(queryRef: QueryRef | CollectionRef): Promise<QuerySnapshot> {
  const collectionName = queryRef.collection
  const table = tableForCollection(collectionName)
  const baseConstraints = queryRef.kind === 'query' ? queryRef.constraints : []
  const constraints = [...normalizeProfileRoleFilter(collectionName), ...baseConstraints]
  const flatConstraints = flattenConstraints(constraints)

  // Warm the identity cache so synchronous applyWhereClause calls below can
  // translate auth user ids to profile ids for FK columns.
  await getCurrentIdentity()

  let builder = supabase.from(table).select('*')
  let limitCount: number | null = null
  let lastOrderBy: { field: string; direction: 'asc' | 'desc' } | null = null

  for (const constraint of flatConstraints) {
    if (constraint.kind === 'where') {
      builder = applyWhereClause(builder, table, constraint.field, constraint.op, constraint.value)
    } else if (constraint.kind === 'orderBy') {
      lastOrderBy = { field: constraint.field, direction: constraint.direction }
      builder = builder.order(toDbField(table, constraint.field), { ascending: constraint.direction !== 'desc' })
    } else if (constraint.kind === 'limit') {
      limitCount = constraint.count
    } else if (constraint.kind === 'startAfter') {
      const cursor = constraint.cursor
      const cursorData = cursor.data()
      const orderField = lastOrderBy?.field || 'createdAt'
      const dbField = toDbField(table, orderField)
      const rawValue = cursorData[orderField] ?? cursorData.createdAt ?? cursor.id
      const normalized = normalizeQueryValue(rawValue, dbField)
      if (lastOrderBy?.direction === 'desc') {
        builder = builder.lt(dbField, normalized)
      } else {
        builder = builder.gt(dbField, normalized)
      }
    }
  }

  if (limitCount !== null) {
    builder = builder.limit(limitCount)
  }

  const { data, error } = await builder
  if (error) {
    throw new Error(error.message)
  }

  const docs: SnapshotDoc[] = (data || []).map((row) => {
    const converted = convertRecordFromDb(row as Record<string, any>, table)
    const docId = String((row as Record<string, any>).id ?? converted.id ?? '')
    return {
      id: docId,
      ref: { kind: 'doc', collection: collectionName, id: docId },
      data: () => converted,
      exists: () => true
    }
  })

  return buildQuerySnapshot(docs)
}

function buildQuerySnapshot(docs: SnapshotDoc[], changes?: DocChange[]): QuerySnapshot {
  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    docChanges: () =>
      changes ??
      docs.map((doc) => ({
        type: 'added' as const,
        doc
      })),
    forEach(callback: (doc: SnapshotDoc, index?: number) => void) {
      docs.forEach((doc, index) => callback(doc, index))
    }
  }
}

export class Timestamp {
  readonly seconds: number
  readonly nanoseconds: number

  constructor(seconds: number, nanoseconds: number = 0) {
    this.seconds = seconds
    this.nanoseconds = nanoseconds
  }

  static now(): Timestamp {
    const now = Date.now()
    return new Timestamp(Math.floor(now / 1000), (now % 1000) * 1_000_000)
  }

  static fromDate(date: Date): Timestamp {
    const ms = date.getTime()
    return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1_000_000)
  }

  toDate(): Date {
    return new Date(this.seconds * 1000 + Math.floor(this.nanoseconds / 1_000_000))
  }
}

export function getFirestore() {
  return dbInstance
}

export const db = getFirestore()

export function collection(_db: unknown, collectionName: string): CollectionRef {
  return { kind: 'collection', collection: collectionName }
}

function generateDocId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function doc(arg1: unknown, arg2?: string, arg3?: string): DocRef {
  if (arg1 && typeof arg1 === 'object' && (arg1 as CollectionRef).kind === 'collection') {
    const collectionRef = arg1 as CollectionRef
    return {
      kind: 'doc',
      collection: collectionRef.collection,
      id: arg2 || generateDocId(),
    }
  }
  if (typeof arg3 === 'string') {
    return { kind: 'doc', collection: arg2!, id: arg3 }
  }
  if (typeof arg2 === 'string') {
    return { kind: 'doc', collection: arg2, id: arg3 || generateDocId() }
  }
  return { kind: 'doc', collection: String(arg1), id: generateDocId() }
}

export function where(field: string, op: string, value: unknown): QueryConstraint {
  return { kind: 'where', field, op, value }
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): QueryConstraint {
  return { kind: 'orderBy', field, direction }
}

export function limit(count: number): QueryConstraint {
  return { kind: 'limit', count }
}

export function startAfter(cursor: SnapshotDoc): QueryConstraint {
  return { kind: 'startAfter', cursor }
}

export function and(...constraints: QueryConstraint[]): QueryConstraint {
  return { kind: 'and', constraints }
}

export function query(source: CollectionRef | QueryRef, ...constraints: QueryConstraint[]): QueryRef {
  const baseCollection = source.collection
  const inherited = source.kind === 'query' ? source.constraints : []
  return { kind: 'query', collection: baseCollection, constraints: [...inherited, ...constraints] }
}

export async function getDocs(source: CollectionRef | QueryRef): Promise<QuerySnapshot> {
  return runQuery(source)
}

export async function getDoc(docRef: DocRef) {
  const table = tableForCollection(docRef.collection)
  await getCurrentIdentity()
  let builder = supabase.from(table).select('*').eq('id', docRef.id).limit(1)

  for (const roleFilter of normalizeProfileRoleFilter(docRef.collection)) {
    if (roleFilter.kind === 'where') {
      builder = applyWhereClause(builder, table, roleFilter.field, roleFilter.op, roleFilter.value)
    }
  }

  const { data, error } = await builder
  if (error) {
    throw new Error(error.message)
  }

  const row = data && data[0]
  const converted = row ? convertRecordFromDb(row as Record<string, any>, table) : null
  return {
    id: row?.id ? String(row.id) : docRef.id,
    ref: docRef,
    exists: () => Boolean(row),
    data: () => (converted || {})
  }
}

export function serverTimestamp(): Timestamp {
  return Timestamp.now()
}

export function arrayUnion(...items: unknown[]) {
  return { __op: 'arrayUnion' as const, items }
}

async function resolveArrayUnionPayload(docRef: DocRef, data: Record<string, any>): Promise<Record<string, any>> {
  const keys = Object.keys(data).filter((key) => data[key]?.__op === 'arrayUnion')
  if (keys.length === 0) return data

  const existing = await getDoc(docRef)
  const existingData = existing.exists() ? existing.data() : {}
  const next = { ...data }
  for (const key of keys) {
    const current = Array.isArray(existingData[key]) ? existingData[key] : []
    const incoming = Array.isArray(next[key].items) ? next[key].items : []
    next[key] = [...current, ...incoming]
  }
  return next
}

export async function addDoc(collectionRef: CollectionRef, data: Record<string, any>) {
  const table = tableForCollection(collectionRef.collection)
  await getCurrentIdentity()
  const payload = convertRecordToDb(data, table)

  const roleConstraint = PROFILE_COLLECTION_ROLE_FILTER[collectionRef.collection]
  if (roleConstraint !== undefined && roleConstraint !== null && !payload.role) {
    payload.role = roleConstraint
  }

  const { data: inserted, error } = await supabase.from(table).insert(payload).select('id').single()
  if (error) {
    throw new Error(error.message)
  }
  return { id: String(inserted?.id), path: `${collectionRef.collection}/${inserted?.id}` }
}

export async function setDoc(docRef: DocRef, data: Record<string, any>, options?: { merge?: boolean }) {
  const table = tableForCollection(docRef.collection)
  await getCurrentIdentity()
  const normalized = await resolveArrayUnionPayload(docRef, data)
  const payload = convertRecordToDb(normalized, table)

  if (options?.merge) {
    const { error } = await supabase.from(table).update(payload).eq('id', docRef.id)
    if (error) throw new Error(error.message)
    return
  }

  const { error } = await supabase.from(table).upsert({ id: docRef.id, ...payload })
  if (error) {
    throw new Error(error.message)
  }
}

export async function updateDoc(docRef: DocRef, data: Record<string, any>) {
  const table = tableForCollection(docRef.collection)
  await getCurrentIdentity()
  const normalized = await resolveArrayUnionPayload(docRef, data)
  const payload = convertRecordToDb(normalized, table)

  const { error } = await supabase.from(table).update(payload).eq('id', docRef.id)
  if (error) {
    throw new Error(error.message)
  }
}

export async function deleteDoc(docRef: DocRef) {
  const table = tableForCollection(docRef.collection)
  const { error } = await supabase.from(table).delete().eq('id', docRef.id)
  if (error) {
    throw new Error(error.message)
  }
}

export function writeBatch(_db: unknown) {
  const operations: Array<() => Promise<void>> = []
  return {
    set(ref: DocRef, data: Record<string, any>) {
      operations.push(async () => {
        await setDoc(ref, data)
      })
    },
    update(ref: DocRef, data: Record<string, any>) {
      operations.push(async () => {
        await updateDoc(ref, data)
      })
    },
    delete(ref: DocRef) {
      operations.push(async () => {
        await deleteDoc(ref)
      })
    },
    async commit() {
      for (const operation of operations) {
        await operation()
      }
    },
  }
}

export function onSnapshot(source: CollectionRef | QueryRef, callback: (snapshot: QuerySnapshot) => void) {
  let active = true
  const knownDocIds = new Set<string>()

  const load = async () => {
    try {
      const snapshot = await getDocs(source)
      const changes: DocChange[] = []

      for (const doc of snapshot.docs) {
        if (!knownDocIds.has(doc.id)) {
          knownDocIds.add(doc.id)
          changes.push({ type: 'added', doc })
        }
      }

      if (active) {
        callback(buildQuerySnapshot(snapshot.docs, changes))
      }
    } catch (error) {
      console.error('onSnapshot query failed:', error)
    }
  }

  void load()
  const timer = setInterval(load, 10000)
  return () => {
    active = false
    clearInterval(timer)
  }
}
