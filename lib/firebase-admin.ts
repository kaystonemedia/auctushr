import { supabaseAdmin } from '@/lib/supabase/admin'
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

type Clause = { field: string; op: string; value: unknown }

const COLLECTION_TABLE_MAP: Record<string, string> = {
  taskRecords: 'task_records',
  productivityScores: 'productivity_records',
  settings: 'app_settings',
  payrollUpdates: 'audit_logs',
  notifications: 'notifications'
}

function toSnakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase()
}

function mapTable(collection: string): string {
  return COLLECTION_TABLE_MAP[collection] || collection
}

function applyWhere(builder: any, clause: Clause) {
  const field = toSnakeCase(clause.field)
  switch (clause.op) {
    case '==':
      return builder.eq(field, clause.value)
    case '>=':
      return builder.gte(field, clause.value)
    case '<=':
      return builder.lte(field, clause.value)
    default:
      return builder.eq(field, clause.value)
  }
}

class QueryBuilder {
  constructor(private readonly collectionName: string, private readonly clauses: Clause[] = []) {}

  where(field: string, op: string, value: unknown) {
    return new QueryBuilder(this.collectionName, [...this.clauses, { field, op, value }])
  }

  async get() {
    let builder = supabaseAdmin.from(mapTable(this.collectionName)).select('*')
    for (const clause of this.clauses) {
      builder = applyWhere(builder, clause)
    }
    const { data, error } = await builder
    if (error) {
      throw new Error(error.message)
    }
    const docs = (data || []).map((row) => ({
      id: String((row as Record<string, unknown>).id ?? ''),
      data: () => row,
      exists: () => true
    }))
    return { docs, empty: docs.length === 0 }
  }
}

class CollectionRef extends QueryBuilder {
  constructor(private readonly name: string) {
    super(name, [])
  }

  doc(id: string) {
    const collectionName = this.name
    return {
      async set(payload: Record<string, unknown>) {
        const { error } = await supabaseAdmin.from(mapTable(collectionName)).upsert({
          id,
          ...payload
        })
        if (error) {
          throw new Error(error.message)
        }
      },
      async get() {
        const { data, error } = await supabaseAdmin
          .from(mapTable(collectionName))
          .select('*')
          .eq('id', id)
          .maybeSingle()
        if (error) {
          throw new Error(error.message)
        }
        return {
          exists: Boolean(data),
          data: () => data,
          id
        }
      }
    }
  }

  async add(payload: Record<string, unknown>) {
    const { error } = await supabaseAdmin.from(mapTable(this.name)).insert(payload)
    if (error) {
      throw new Error(error.message)
    }
  }
}

export const db = {
  collection(name: string) {
    return new CollectionRef(name)
  }
}

export const adminDb = db
export const adminAuth = null

export async function verifySessionCookie(_sessionCookie: string) {
  throw new Error('verifySessionCookie is no longer supported. Use Supabase access tokens.')
}

export async function createSessionCookie(_idToken: string, _expiresIn: number) {
  throw new Error('createSessionCookie is no longer supported. Use Supabase access tokens.')
}

export async function revokeSessionCookie(_sessionCookie: string) {
  return
}

export function getAdminAuth() {
  return null
}

export function getAdminDb() {
  return db
}

export function isFirebaseAdminInitialized() {
  return true
}

export function getFirebaseAdminStatus() {
  return {
    authInitialized: false,
    dbInitialized: true,
    initializationError: null,
    envVarsPresent: {}
  }
}
