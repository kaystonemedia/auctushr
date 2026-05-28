# Phase 2 migration progress

> **Full review doc:** see [`MIGRATION_PHASE2_REVIEW.md`](./MIGRATION_PHASE2_REVIEW.md) for APIs, file list, schema mapping, tests, and known limitations.

## Status: Phase 2 complete (2a–2d) + cleanup

Core HR flows now use `/api/*` + Supabase. Legacy compat adapter files have been inlined into `lib/data/*` and removed.

## Phase 2a

- Attendance check-in/out → `/api/attendance/records`
- Admin dashboard → `/api/dashboard/summary`
- Task modals/list → `/api/tasks`, `/api/employees`

## Phase 2b

- Manager dashboard, attendance page, my-tasks, task-details comments

## Phase 2c

- Leave module, employees, departments, payroll dashboard

## Phase 2d

- `employee-attendance-history`, `team-attendance-overview`
- `break-timer` (local), `shift-schedule` (sessionStorage)
- `whos-away`, `departments/[id]`
- `payment-status-tracker`, `bulk-payroll-processor`, `enhanced-payroll-form`
- `dashboard` + `dashboard/employee` + `main/dashboard/employee` moved off Firestore reads
- `audit-logs` moved to `/api/audit-logs`
- `attendance/reports` + `attendance/settings` moved to API routes
- `managers` + `administrators` lists now backed by `/api/employees`
- `profile` moved off Firebase writes (`updateUser` + `/api/auth/change-password`)
- `auth/forgot-password` moved to `/api/auth/forgot-password`
- `wellness-check-in` now API-backed via `/api/wellness/summary`
- `productivity-dashboard` task data now sourced from `/api/tasks` + `/api/employees`
- `debug-assignments` + `fix-assignments` migrated to `/api/employees`
- `employee-form`, `employee-table`, and `add-employee-modal` migrated off Firestore lookups
- `add-admin-modal` + `add-manager-modal` now create via `/api/employees`
- `teams-table` + `administrators/overview-table` now API-backed with polling
- `attendance analytics/map/table` and `payroll-form` migrated off direct Firestore imports
- core `lib/*` and `firebaseConfig.ts` imports switched to compat modules (`firebase-compat/*`) during migration
- introduced neutral adapter layer: `lib/data/auth.ts` and `lib/data/firestore.ts`
- service modules now depend on `lib/data/*` instead of `lib/firebase-compat/*`
- final cleanup: moved adapter implementations into `lib/data/*` (`auth`, `firestore`, `identity`, `app`) and removed `lib/firebase-compat/*`
- removed Firebase path aliases from `tsconfig.json` (`firebase/app`, `firebase/auth`, `firebase/firestore`)
- `contexts/new-auth-context.tsx` legacy duplicate import block neutralized; active context remains API-session based
- repository grep is now clean for direct import patterns (`firebase/firestore`, `firebase/auth`, `@/lib/firebase`)

## Deferred (Phase 3)

- `shifts` / `breaks` Supabase tables
