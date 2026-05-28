-- =============================================================================
-- One-time recovery: force every Firebase-migrated user to re-set their password
-- =============================================================================
--
-- WHY THIS IS NEEDED
--   When the Firestore -> Supabase migration script (`migrate-to-supabase.js`)
--   provisions auth users it has to set *some* password, because Firebase does
--   not expose the original password hashes. That default password is unknown
--   to end users, so when they try to log in with their old Firebase password
--   Supabase's `signInWithPassword` returns "Invalid login credentials".
--
--   This script marks every migrated profile as having no password yet, which
--   routes the user through the existing first-time-password setup flow on
--   their next login attempt. That flow updates the underlying Supabase Auth
--   user with the new password chosen by the user.
--
-- HOW TO RUN
--   Open the Supabase SQL Editor for the target project and execute this file.
--   It is safe to run more than once; it only touches profiles whose metadata
--   carries the migration marker.
-- =============================================================================

BEGIN;

UPDATE public.profiles
SET
  has_password = false,
  requires_password_change = true,
  updated_at = timezone('utc', now())
WHERE
  -- All rows seeded by migrate-to-supabase.js carry source_collection in
  -- metadata. We only reset those rows so accounts created natively in
  -- Supabase are left alone.
  metadata ? 'source_collection'
  AND coalesce(metadata->>'source_collection', '') <> '';

-- Visibility: how many profiles were touched
SELECT
  count(*) AS migrated_profiles_reset,
  count(*) FILTER (WHERE auth_user_id IS NOT NULL) AS with_auth_user,
  count(*) FILTER (WHERE auth_user_id IS NULL)     AS without_auth_user
FROM public.profiles
WHERE metadata ? 'source_collection';

COMMIT;

-- =============================================================================
-- (Optional) Verify a specific account
-- =============================================================================
-- SELECT email, has_password, requires_password_change, auth_user_id,
--        metadata->>'source_collection' AS legacy_source
-- FROM public.profiles
-- WHERE email = 'someone@example.com';
