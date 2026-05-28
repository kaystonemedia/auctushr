# Phase 2 migration — review document

This document summarizes the **Firebase/Firestore → Supabase API** migration completed across Phase 2 (2a–2d). Use it for code review, QA planning, and handoff.

**Related docs**

- `docs/PHASE1_TEST_CHECKLIST.md` — auth, profile, tools, monitoring baseline tests
- `docs/PHASE2_PROGRESS.md` — short running log
- `supabase/schema.sql` — source of truth for tables and RLS

---

## Architecture change (what we did)

| Before | After |
|--------|--------|
| UI imported `firebase/firestore` (often via `tsconfig` alias to `lib/firebase-compat/*`) | Hot paths call **`/api/*` routes** with `credentials: 'include'` (session cookie) |
| Real-time `onSnapshot` listeners | **Polling** (typically 45–60s) or refetch after mutations |
| Legacy collection names (`attendance`, `leaveRequests`, `payrollEntries`) | Supabase tables (`attendance_records`, `leave_requests`, `payroll_entries`, `profiles`) |

**Auth:** `lib/api-auth.ts` resolves the user from `sb-access-token` cookie or `Authorization: Bearer`.

**Admin writes:** Server routes use `supabaseAdmin` (service role) after role checks.

---

## New API routes (Phase 2)

### Attendance

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/attendance/records` | List records (`date`, `fromDate`, `toDate`, `employeeId`) |
| POST | `/api/attendance/records` | Check-in |
| POST | `/api/attendance/records/[id]/checkout` | Check-out |
| POST | `/api/attendance/records/[id]/approval` | Approve/reject (`action`: `approved` \| `rejected`) |
| PATCH | `/api/attendance/records/[id]` | Update idle/active minutes, flags |
| GET | `/api/attendance/office-locations` | Office locations |

**Helper:** `lib/attendance-mappers.ts` — maps DB rows ↔ client `AttendanceRecord`.

### Dashboard

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/dashboard/summary` | Admin/manager stats, department chart, `teamMembers`, audit activity |

### Tasks (existing, wired in UI)

| Method | Route |
|--------|-------|
| GET/POST | `/api/tasks` |
| GET/PUT/POST/DELETE | `/api/tasks/[id]` (POST = add comment in `metadata.comments`) |
| GET/POST/PUT/DELETE | `/api/employees` |

### Leave

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/leave/requests` | `view=all\|pending\|my`, `fromDate`, `toDate`, `status` |
| POST | `/api/leave/requests` | Submit (overlap + balance checks) |
| PATCH | `/api/leave/requests/[id]` | Approve/reject |
| GET | `/api/leave/balance` | Balance (auto-creates defaults) |

**Helpers:** `lib/leave-mappers.ts`, `lib/notify-user.ts` (inserts into `notifications`).

### Departments

| Method | Route |
|--------|-------|
| GET/POST/PUT/DELETE | `/api/departments` |
| GET | `/api/departments/[id]` — department + employees |

### Audit logs

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/audit-logs` | Admin audit feed (latest N rows) |

### Payroll

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/payroll/entries` | List (`periodMonth`, `employeeId`, `hasPayment`) |
| POST | `/api/payroll/entries` | Create/process entry (admin) |

Existing Paystack routes unchanged: `/api/payroll/paystack`, `/api/payroll/status`, webhooks, etc.

### Notifications

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/notifications/send` | Bulk notify (`userIds`, `title`, `message`) |

### Auth recovery + wellness

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/auth/forgot-password` | Trigger Supabase recovery email (non-enumerating response) |
| GET | `/api/wellness/summary` | Department + employee wellness summary (last 30 days) |

### Profile (Phase 1, used by app)

| Method | Route |
|--------|-------|
| POST | `/api/profile/avatar` |

---

## UI migrations by area

### Phase 2a — Attendance check-in/out, admin dashboard, tasks

| File | Change |
|------|--------|
| `components/attendance-check-in.tsx` | POST `/api/attendance/records` |
| `components/attendance-check-out.tsx` | POST checkout route |
| `components/dashboard/admin-dashboard.tsx` | GET `/api/dashboard/summary` |
| `components/tasks/create-task-modal.tsx` | `/api/tasks`, `/api/employees` |
| `components/tasks/edit-task-modal.tsx` | `/api/tasks/[id]` |
| `components/tasks/task-list.tsx` | `/api/tasks` |
| `components/tasks/employee-select.tsx` | `/api/employees` |

### Phase 2b — Manager dashboard, attendance page, my-tasks

| File | Change |
|------|--------|
| `app/my-tasks/page.tsx` | Fixed broken Firestore listener; GET `/api/tasks?assigneeId=` |
| `components/dashboard/manager-dashboard.tsx` | Rewritten; GET `/api/dashboard/summary` |
| `app/attendance/page.tsx` | Records, approval, idle PATCH via API |
| `components/tasks/task-details-modal.tsx` | POST comment on `/api/tasks/[id]` |

### Phase 2c — Leave, employees, departments, payroll dashboard

| File | Change |
|------|--------|
| `components/leave-requests-list.tsx` | Full rewrite → leave API |
| `components/leave-request-form.tsx` | Full rewrite → leave API |
| `components/leave-balance.tsx` | GET `/api/leave/balance` |
| `app/employees/page.tsx` | Full CRUD `/api/employees` (no Firestore) |
| `app/departments/page.tsx` | `/api/departments` |
| `components/departments/department-form.tsx` | `/api/departments` + `/api/employees` for managers |
| `components/payroll/payroll-dashboard.tsx` | Employees + entries API; process payroll POST |

### Phase 2d — Attendance widgets, whos-away, dept detail, payroll forms

| File | Change |
|------|--------|
| `components/attendance/employee-attendance-history.tsx` | GET records (90-day window) |
| `components/team-attendance-overview.tsx` | `/api/employees` + today's attendance |
| `components/attendance/break-timer.tsx` | **Session-local only** (no `breaks` table yet) |
| `components/attendance/shift-schedule.tsx` | **sessionStorage** (no `shifts` table yet); `useNewAuth` |
| `app/whos-away/page.tsx` | Leave API + employees API |
| `app/departments/[id]/page.tsx` | GET `/api/departments/[id]`; notify via `/api/notifications/send` |
| `app/audit-logs/page.tsx` | GET `/api/audit-logs` |
| `app/dashboard/page.tsx` | Uses `/api/dashboard/summary` + `/api/payroll/insights` (no Firestore reads) |
| `app/dashboard/employee/page.tsx` | Attendance cards via `/api/attendance/records` |
| `app/main/dashboard/employee/page.tsx` | Attendance cards via `/api/attendance/records` |
| `app/managers/page.tsx` | Managers list via `/api/employees` |
| `app/administrators/page.tsx` | Admin list via `/api/employees` |
| `app/profile/page.tsx` | Name + password updates via API (`updateUser`, `/api/auth/change-password`) |
| `app/auth/forgot-password/page.tsx` | Uses `/api/auth/forgot-password` instead of Firebase Auth SDK |
| `app/wellness-check-in/page.tsx` | Reads `/api/wellness/summary`; no direct Firestore queries |
| `components/productivity/productivity-dashboard.tsx` | Task loading switched from Firestore to `/api/tasks` + `/api/employees` |
| `app/debug-assignments/page.tsx` | Uses `/api/employees` instead of direct Firestore collection reads |
| `app/fix-assignments/page.tsx` | Batch manager assignment repair now uses `/api/employees` (preview + PUT updates) |
| `components/employee-form.tsx` | Department/manager loading now via `/api/departments` + `/api/employees` |
| `components/employee-table.tsx` | Manager lookup now via `/api/employees` |
| `components/add-employee-modal.tsx` | Department loading now via `/api/departments` |
| `components/administrators/add-admin-modal.tsx` | Department loading + admin creation via API routes |
| `components/managers/add-manager-modal.tsx` | Department loading + manager creation via API routes |
| `components/managers/teams-table.tsx` | Team/idle data now API-backed; polling replaces Firestore snapshot |
| `components/administrators/overview-table.tsx` | Admin overview now API-backed (employees + attendance APIs) |
| `components/payroll/payroll-form.tsx` | Payroll writes moved to `POST /api/payroll/entries` |
| `components/attendance-map.tsx` | Map attendance feed now sourced from `/api/attendance/records` |
| `components/attendance/analytics-dashboard.tsx` | Analytics data now sourced from `/api/attendance/records` + `/api/employees` |
| `components/attendance-table.tsx` | Removed obsolete Firebase imports; purely prop-driven view |
| `components/task-list.tsx` | Removed Firestore `Timestamp` dependency |
| `components/payroll/payment-status-tracker.tsx` | GET `/api/payroll/entries?hasPayment=true` |
| `components/payroll/bulk-payroll-processor.tsx` | Employees + POST entries after Paystack bulk |
| `components/payroll/enhanced-payroll-form.tsx` | Attendance + payroll via API |
| `app/attendance/reports/page.tsx` | Reports + approvals via `/api/attendance/records` + approval route |
| `app/attendance/settings/page.tsx` | Settings via `/api/settings`; office locations CRUD via `/api/attendance/office-locations` |

---

## Schema mapping (legacy → Supabase)

| Legacy (compat/Firestore) | Supabase table |
|---------------------------|----------------|
| `attendance` / `attendance_records` | `attendance_records` |
| `leaveRequests` | `leave_requests` |
| `leaveBalances` | `leave_balances` (id: `{profileId}_{year}`) |
| `payrollEntries` | `payroll_entries` |
| `employees` / `users` / `managers` | `profiles` |
| `departments` | `departments` (`manager_profile_id`) |
| `tasks` | `tasks` + `task_assignees` |
| `shifts` | *Not migrated* — sessionStorage UI only |
| `breaks` | *Not migrated* — local break timer only |

---

## Known limitations / deferred

1. **Shifts** — No `shifts` table; `ShiftScheduler` persists to `sessionStorage` per browser session.
2. **Breaks** — No `breaks` table; `BreakTimer` is in-memory for the session.
3. **Compat/service layer** — Remaining Firebase dependencies now live in `lib/*`, `contexts/new-auth-context.tsx`, and `firebaseConfig.ts` (service utilities still pending full Supabase conversion).
4. **Payroll duplicate POST** — Enhanced form may create a pending entry before Paystack; bulk processor POSTs after payment success. Review idempotency per `employee_id` + `period_month` if duplicates appear.
5. **Manager employee list on attendance page** — Uses same records API as admin; manager scope is enforced server-side via `manager_id` on profiles.

---

## Recommended test checklist (Phase 2)

### Attendance
- [ ] Employee check-in / check-out on `/attendance`
- [ ] Manager approves/rejects a record
- [ ] Employee dashboard → attendance history tab loads
- [ ] Team attendance overview (manager attendance page)

### Leave
- [ ] Submit leave as employee; overlap validation
- [ ] Manager approves/rejects; notification appears (Supabase `notifications`)
- [ ] `/whos-away` calendar for current month

### HR data
- [ ] `/employees` add, edit, delete
- [ ] `/departments` CRUD; open `/departments/[id]`; send bulk notification

### Payroll (admin)
- [ ] Dashboard loads employees and entries
- [ ] Process single payroll (dashboard button)
- [ ] Enhanced payroll form: calculate → save → Paystack (if configured)
- [ ] Bulk processor: select employees → run → entries created
- [ ] Payment status tracker shows rows with `payment` JSON

### Tasks & dashboard
- [ ] `/tasks` CRUD; task comments in details modal
- [ ] `/my-tasks` for employee
- [ ] Admin + manager dashboards refresh stats

---

## Files added (libs + routes)

```
lib/attendance-mappers.ts
lib/leave-mappers.ts
lib/notify-user.ts
app/api/attendance/records/route.ts (+ [id], checkout, approval)
app/api/dashboard/summary/route.ts
app/api/leave/requests/route.ts (+ [id])
app/api/leave/balance/route.ts
app/api/departments/route.ts (+ [id])
app/api/payroll/entries/route.ts
app/api/notifications/send/route.ts
```

---

## Remaining compat layer work

- Direct import patterns (`firebase/firestore`, `firebase/auth`, `@/lib/firebase`) are now grep-clean across the repository.
- App/service code now imports through neutral adapters in `lib/data/*` (`auth`, `firestore`, `identity`, `app`).
- `tsconfig` no longer aliases `firebase/*` paths to compat files.
- Legacy `lib/firebase-compat/*` has been removed after inlining the adapter implementations into `lib/data/*`.

**Phase 3 suggestion:** Add `shifts` / `breaks` tables if product requires persistence.

---

## Reviewer notes

- All new routes should be called with **`credentials: 'include'`** from the browser.
- **RLS** applies to direct Supabase client access; API routes use **service role** after auth — do not expose service key to the client.
- After pulling this branch: apply `supabase/schema.sql`, ensure `documents` bucket exists for avatars, run `npm run build`, then walk the checklist above.

*Last updated: Phase 2d completion.*
