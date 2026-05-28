# Supabase Migration Master Plan (End-to-End)

This plan is written as an execution checklist to migrate the full project from Firebase to Supabase with rollback safety and production controls.

## 0) Scope and Success Criteria

Migration is complete only when all of the following are true:

- Authentication uses Supabase Auth for all web and API flows.
- Application data is stored in Supabase Postgres tables (no Firestore writes).
- File storage uses Supabase Storage buckets (no Firebase Storage writes).
- API authorization uses Supabase-backed profile role checks.
- Background jobs and integrations (Paystack/webhooks/email/audit/monitoring) write to Supabase.
- Firebase dependencies are removed from runtime code and environments.
- Observability, backups, and rollback procedures are validated.

## 1) Preparation and Controls

1. Freeze schema-changing feature work for the migration window.
2. Create a dedicated migration branch and CI pipeline for dual-environment checks.
3. Capture production snapshots:
   - Firestore export (all collections, indexes, rules).
   - Firebase Auth users export.
   - Firebase Storage object inventory.
4. Create Supabase project and enable:
   - Auth, Postgres backups/PITR, Realtime (optional), Storage, Log drains.
5. Rotate and revoke any leaked credentials before migration.

## 2) Target Data Model

Use `supabase/schema.sql` as the baseline migration.

Core mapping:

- `users`, `managers`, `employees` -> `profiles` (single canonical identity/profile table).
- `settings/global` -> `app_settings` (`key='global'`).
- `attendance` -> `attendance_records`.
- `tasks` -> `tasks`, `task_assignees`, `task_records`.
- `payrollEntries` -> `payroll_entries`.
- `notifications` -> `notifications`.
- `documents` -> `documents`.
- `auditLogs` -> `audit_logs`.
- `emailLogs` -> `email_logs`.
- `monitoring/*`, `unified_*`, `productivity_*` -> `monitoring_events` + `productivity_records` (+ legacy payload during transition).

## 3) Auth Migration

1. Enable email/password auth in Supabase.
2. Import Firebase Auth users to Supabase Auth:
   - Create Supabase auth users with matching emails.
   - Preserve old Firebase UID in `profiles.metadata.firebase_uid`.
3. Link auth users to `profiles.auth_user_id`.
4. Use session cookies `sb-access-token` and `sb-refresh-token`.
5. Replace any mock session code with real token verification (`supabaseAdmin.auth.getUser`).
6. Enforce server-side role checks via `profiles.role`.

## 4) Data Migration Strategy

### Phase A: Backfill (non-destructive)

1. Run Supabase schema migration.
2. Run one-time Firestore -> Supabase import script (`migrate-to-supabase.js`).
3. Preserve unmapped docs in `legacy_firestore_dump`.
4. Run row counts and checksum comparisons by entity.

### Phase B: Dual-write

1. Turn on dual-write in API handlers:
   - Primary write to Supabase.
   - Optional fallback write to Firestore for safety period.
2. Compare read consistency dashboards daily.

### Phase C: Read cutover

1. Move reads by module: auth -> employees -> attendance -> tasks -> payroll -> notifications -> documents -> monitoring.
2. Monitor error rates and mismatches.
3. Remove Firestore reads once stable.

### Phase D: Write cutover

1. Disable Firestore writes.
2. Keep rollback toggle for 1 release cycle.
3. Remove Firebase runtime dependencies after soak period.

## 5) API/Code Migration Order

Execute in this order to minimize auth and data integrity risks:

1. `lib/auth.ts`, `lib/api-auth.ts`, auth API routes, middleware.
2. Employee/profile and organization routes.
3. Attendance + leave + productivity.
4. Tasks + analytics + gamification.
5. Payroll + Paystack webhooks.
6. Documents + storage flows.
7. Notifications + audit + email logs.
8. Monitoring and desktop sync APIs.

## 6) Storage Migration

1. Create Supabase Storage buckets (`documents`, `screenshots`, `avatars`).
2. Copy objects from Firebase Storage preserving key paths.
3. Update DB metadata references (`documents.storage_path`, screenshot payloads).
4. Enable signed URL access where appropriate.

## 7) Security and Compliance

1. Apply RLS policies from `supabase/schema.sql`.
2. Validate policy matrix:
   - employee: self-only records.
   - manager: team visibility.
   - admin: full org.
3. Add audit hooks on sensitive writes (payroll/settings/security).
4. Add rate limits and webhook signature verification checks.

## 8) Validation and Reconciliation

For each module, validate:

- Row counts (source vs target).
- Critical aggregates (payroll totals, attendance hours, open tasks).
- Permission behavior by role.
- API contract compatibility (response shapes and status codes).

Create a migration QA checklist and signoff per module before cutover.

## 9) Rollback Plan

Rollback triggers:

- >2% auth failure spike
- >1% read mismatch on critical entities
- Payroll or attendance write integrity issues

Rollback actions:

1. Flip reads back to Firebase (feature flag).
2. Keep Supabase write capture for postmortem replay.
3. Reconcile failed windows and retry cutover after fix.

## 10) Decommission Checklist

After 2 stable release cycles:

1. Remove Firebase client/admin imports from runtime.
2. Delete Firebase config/env vars.
3. Disable Firebase Auth sign-in methods.
4. Archive Firestore and Storage exports.
5. Remove legacy adapters and `legacy_firestore_dump` usage once no longer needed.

## 11) Operational Runbook (Day-of-Cutover)

1. Enable maintenance mode for writes.
2. Run final incremental import.
3. Run integrity checks.
4. Enable Supabase read path.
5. Enable Supabase write path.
6. Run smoke tests (auth, attendance check-in/out, task CRUD, payroll generation, payslip, notifications, document upload, webhook processing).
7. Announce completion and monitor for 24h with rollback standby.

