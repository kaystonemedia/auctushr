/**
 * Firebase Cloud Functions were retired during the Supabase migration.
 * These placeholders are kept so any legacy imports won't crash at runtime.
 */
export async function syncAttendance() {
  return { skipped: true, reason: 'Migrated to Supabase workflows' }
}

export async function archiveActivityLogs() {
  return { skipped: true, reason: 'Migrated to Supabase workflows' }
}

export async function processPayroll() {
  return { skipped: true, reason: 'Migrated to Supabase workflows' }
}