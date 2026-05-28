import { addDoc, collection, serverTimestamp } from '@/lib/data/firestore'
import { db } from './firebase'

export type AuditOutcome = 'success' | 'failure'

export interface AuditLog {
  action: string
  actorId?: string
  actorRole?: string
  targetType?: string
  targetId?: string
  tenantId?: string
  outcome?: AuditOutcome
  message?: string
  metadata?: Record<string, any>
  ip?: string | null
  userAgent?: string | null
  createdAt?: Date
}

export async function logAudit(log: AuditLog): Promise<void> {
  try {
    const payload = {
      ...log,
      createdAt: new Date(),
      // server-side ordering helper; safe on client too
      createdAtServer: serverTimestamp()
    }
    await addDoc(collection(db, 'auditLogs'), payload)
  } catch (err) {
    // Swallow to avoid breaking primary workflows
    console.error('auditLog error:', err)
  }
}

export async function safeLogAudit(action: string, options: Omit<AuditLog, 'action'> = {}): Promise<void> {
  await logAudit({ action, ...options })
}



