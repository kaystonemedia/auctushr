# Recovering Migrated Users' Passwords

When the project was migrated from Firebase to Supabase, the migration script
(`migrate-to-supabase.js`) had to create a brand-new Supabase Auth user for
every Firestore account, because Firebase does **not** export password hashes.
Each user was therefore provisioned with a *placeholder* password the end user
does not know.

Without intervention, those users see `Invalid login credentials` when they
attempt to sign in with their old Firebase password.

This document describes the one-time fix and the ongoing tools available to
handle the situation.

---

## 1. One-time global fix (run once after migration)

Open the Supabase SQL Editor for the target project and run:

```bash
supabase/fix-migrated-user-passwords.sql
```

It flips `has_password = false` and `requires_password_change = true` on every
profile that carries the migration marker (`metadata->>'source_collection'`).
The next time those users hit the sign-in page, the preflight endpoint reports
`hasPassword: false`, the UI advances directly to the "Set up your account"
step, and the existing `/api/auth/first-time-password` endpoint replaces the
placeholder password with the one the user chooses.

The script is idempotent — it only touches profiles seeded by the migration.

## 2. Login flow self-heal (already deployed)

`app/api/auth/login/route.ts` now inspects the profile when
`signInWithPassword` fails. If the profile carries the migration marker, the
endpoint:

1. Resets `has_password = false`, `requires_password_change = true` on the
   profile so subsequent preflight responses are correct.
2. Returns `409 ACCOUNT_NOT_INITIALIZED`, which the sign-in form already
   handles by transitioning to the setup step.

This means even users we miss with the SQL fix will be auto-corrected the
first time they attempt to log in.

## 3. Admin-driven reset for individual accounts

`POST /api/auth/admin/reset-password` (admin role required) takes:

```json
{ "email": "person@example.com", "sendResetEmail": true }
```

and:

- Marks the profile as needing setup (`has_password = false`,
  `requires_password_change = true`).
- Asks Supabase Auth to email the user a password recovery link
  (`sendResetEmail` defaults to `true`).

### Bootstrap escape hatch

If every admin is still locked out post-migration and you have not yet run
the global SQL fix, you can call the admin endpoint with a shared secret:

```bash
curl -X POST https://<your-app>/api/auth/admin/reset-password \
  -H "Authorization: Bearer $SUPABASE_MIGRATION_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"email":"first.admin@example.com"}'
```

Set `SUPABASE_MIGRATION_ADMIN_SECRET` in the environment to enable this path.
Remove the variable from the environment once recovery is complete.

## 4. Future migration runs are safe

`migrate-to-supabase.js` now tracks the auth users it provisions in-process
and writes `has_password = false` / `requires_password_change = true` for
their profiles, so this state is correct by construction on any re-run.
The placeholder password is also generated per-user (random suffix) instead
of the previous shared `Welcome123!` literal, eliminating that as an
incidental backdoor.

---

## Quick recipe for the user reported issue

1. Run `supabase/fix-migrated-user-passwords.sql` in the Supabase SQL Editor.
2. Tell users to visit the sign-in page and enter their email; the UI will
   ask them to choose a new password and log them straight in.
3. (Optional) For users who report difficulty, an admin can hit
   `POST /api/auth/admin/reset-password` to additionally email them a
   recovery link.
