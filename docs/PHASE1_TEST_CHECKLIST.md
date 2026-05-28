# Phase 1 migration — test checklist

Run with `npm run dev` after `npm run build` succeeds.

## Auth & session
- [ ] Sign in at `/auth/sign-in`
- [ ] `/api/auth/me` returns user with avatar from `profiles.metadata.avatar_url`
- [ ] Sign out clears session

## Tools (web)
- [ ] `/tools` loads without 500
- [ ] Start work → wait 20s → refresh → session persists (background sync)
- [ ] Client work start/end syncs
- [ ] No manual sync button visible

## Monitoring & productivity APIs
- [ ] Manager `/monitoring` loads employee data
- [ ] `GET /api/monitoring/sync` returns screenshots (employee_id schema)
- [ ] Productivity page / scores load without DB errors

## Profile
- [ ] Upload avatar on `/profile` (uses `/api/profile/avatar` + Supabase Storage `documents` bucket)

## Settings (admin)
- [ ] Admin can open `/settings` and save Tools policy
- [ ] Non-admin `PUT /api/settings` returns 403

## Payroll
- [ ] `/payroll` payslip flow uses working API (not payslip-client 410)

## Security
- [ ] `/api/debug/env` returns 404 in production build
- [ ] Unauthenticated `GET /api/settings` returns 401

## Known follow-ups (Phase 2)
- Firebase compat adapter layer has been fully removed; app/service imports now resolve from `lib/data/*`.
- `lib/unified-monitoring-service.ts` unused by sync route but still in codebase
