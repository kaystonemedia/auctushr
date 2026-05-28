/**
 * Helpers for Firebase → Supabase migrated profiles.
 * Migrated users were given unknown placeholder passwords in Supabase Auth.
 */

export function isMigratedFirestoreProfile(metadata: unknown): boolean {
  const meta = (metadata ?? {}) as Record<string, unknown>
  const source = meta.source_collection
  return typeof source === 'string' && source.length > 0
}

export function profileNeedsPasswordSetup(profile: {
  auth_user_id?: string | null
  has_password?: boolean | null
  requires_password_change?: boolean | null
  metadata?: unknown
}): boolean {
  if (!profile.auth_user_id) return true
  if (!profile.has_password) return true
  if (
    isMigratedFirestoreProfile(profile.metadata) &&
    profile.requires_password_change
  ) {
    return true
  }
  return false
}
