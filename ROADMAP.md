# Styletry HR — Quick Wins Roadmap

Purpose: a living plan to close the highest-impact gaps with the least effort. Update this file as items progress.

## How to use this roadmap
- Keep items small and shippable (1–5 days each).  
- Track status with the checkboxes below.  
- Each task has: Why, Acceptance Criteria (AC), and Notes/Dependencies.

## Prioritization
- Priority order: Security/Compliance > Data Integrity > Authorization > Payroll/Attendance reliability > UX wins.  
- Default target: deliver Phase 0 within 1–3 days, Phase 1 within 1–2 weeks.

---

## Phase 0 — Quick Wins (1–3 days)

1) Minimal Audit Logging (core actions)
- [ ] Implement `auditLog(event, actor, target, meta)` utility and call it in: auth login success/failure, employee CRUD, document upload/delete, payroll run/payout, leave approve/reject.
  - Why: Compliance baseline and incident traceability.
  - AC: Records persist to Firestore collection `auditLogs` with timestamp, userId, action, resource, outcome; visible via a basic admin list.
  - Notes: Add simple index `createdAt desc`.

2) Server-side RBAC guard for API routes (top endpoints first)
- [ ] Add a small guard helper (e.g., `requireRole(['admin','manager'])`) and use it in: attendance reports, payroll APIs, documents APIs.
  - Why: Route-level RBAC exists on client; must enforce on server.
  - AC: Protected routes return 403 for unauthorized roles; happy paths unchanged.
  - Notes: Gradually roll out to all API routes.

3) 2FA (TOTP) backend enablement
- [ ] Implement TOTP secret provisioning, verification endpoints, and backup codes to match existing UI toggles.
  - Why: Security uplift with minimal UI changes.
  - AC: Users can enroll/verify TOTP; optional policy flag enforces 2FA; backup codes generated and revocable.
  - Notes: Store hashed backup codes; rate-limit verification.

4) Document service hardening (validation + ownership)
- [ ] Enforce MIME/size allowlist, set owner/department metadata, and version increment on re-upload.
  - Why: Reduce risk and improve traceability.
  - AC: Uploads rejected if disallowed; documents show owner and version; metadata recorded in Firestore.
  - Notes: Keep Supabase as provider; no e-sign yet.

5) Payslip consistency and persistence
- [ ] Standardize payslip schema; persist generated payslips; attach as PDF to employee’s documents.
  - Why: Reliability and employee self-service.
  - AC: POST generates a payslip record, stores a PDF artifact, exposes stable retrieval in `/payslip` UI.
  - Notes: Simple HTML→PDF rendering; version field + processedAt.

6) Leave UX + policy guardrails
- [ ] Prevent overlapping leave for the same employee and dates; send notifications on submit/approve/reject.
  - Why: Common user errors; improves trust.
  - AC: Overlaps blocked with clear error; email/toast notifications fire; pending list updates in near-real-time.
  - Notes: Build simple email using existing settings scaffolding; fallback to in-app toasts.

7) Security headers + API rate limiting
- [ ] Add Helmet/CSP headers for pages and API responses; implement per-IP rate limits for public API routes.
  - Why: Baseline hardening.
  - AC: CSP, X-Frame-Options, HSTS (when HTTPS), and rate limits applied; no regressions in core flows.
  - Notes: Keep CSP permissive initially; iterate later.

8) Admin dashboard tiles: headcount + attendance rate
- [ ] Add simple cards for total employees, active this month, attendance rate (last 30 days).
  - Why: Quick value to stakeholders.
  - AC: Cards render fast; queries indexed; numbers correct within test data.
  - Notes: Use existing analytics utilities where possible.

9) User self-export (personal data)
- [ ] Add endpoint for authenticated users to export their data (profile, attendance, leave, payslips) as JSON.
  - Why: Compliance and trust; low effort.
  - AC: Signed-in user downloads JSON bundle; server-side authorization enforced.
  - Notes: Rate-limit and paginate reads.

---

## Phase 1 — Easy-to-Medium Wins (1–2 weeks)

10) Unified user model façade (no full migration yet)
- [ ] Create a `getEmployeeById` façade that resolves from `users | employees | managers` and normalizes the shape.
  - Why: Reduce duplication pain without risky refactor.
  - AC: All payroll/payslip/attendance code paths call façade; consistent shape returned.
  - Notes: Add `collection` field in responses for traceability.

11) Tenant scaffolding (forward-compatible)
- [ ] Introduce `TenantProvider` and include `tenantId` in new writes; add indexes; no data migration yet.
  - Why: Prepare for multi-tenant without breakage.
  - AC: New records include `tenantId`; Firestore composite indexes added; middleware resolves tenant from request (stub allowed).
  - Notes: Feature-flag read paths to prefer tenantId when available.

12) Onboarding checklists (templated)
- [ ] Add simple onboarding tasks per employee (account setup, docs, training), due dates, and reminders.
  - Why: High perceived value; low complexity.
  - AC: Create from template on hire; track completion; reminder notifications before due.
  - Notes: Store under `employees/{id}/onboardingTasks`.

13) Document expiry reminders
- [ ] Scheduled function scans `documents.expirationDate` and notifies owners/HR N days before expiry.
  - Why: Saves HR time; prevents compliance lapses.
  - AC: Daily job sends reminders; avoids duplicates; records sent status.
  - Notes: Reuse notifications settings.

14) Bank info self-service with approval
- [ ] Employee submits bank changes → manager/HR approve → auto-apply.
  - Why: Reduces HR manual work; adds control.
  - AC: Requests have statuses; audit logged; changes applied only on approval.
  - Notes: Consider dual approval for high-risk fields later.

15) Attendance policy polish
- [ ] Late/early thresholds applied in analytics; flagging shown in reports; export includes flags.
  - Why: Better signal fidelity.
  - AC: Flags appear in UI and CSV; counts summarized.
  - Notes: Use existing idle/flag detection utilities.

---

## Phase 2 — Next Up (2–4 weeks)

16) ATS MVP
- [ ] Job postings, candidates, stages, notes; Kanban with real data; basic email templates.
  - AC: CRUD + drag-drop stages; candidate timeline; simple exports.

17) Performance MVP
- [ ] Goals/OKRs per employee and quarterly reviews with ratings and comments.
  - AC: Create/edit goals; review cycle; manager sign-off; export PDF.

18) Shift policy + overtime calculations
- [ ] Define shifts per department; compute overtime and holiday pay in reports.
  - AC: Policies applied to attendance; reports show computed OT/holiday hours.

---

## Backlog (track as we discover)
- E-signature integration for documents (Dropbox Sign/HelloSign).  
- Executive dashboards (headcount, attrition, DEI, comp).  
- Full per-tenant RBAC and domain branding.  
- Mobile/PWA enhancements.  
- Reconciliation reports for payroll payouts.  

---

## Tracking

Legend:  
Status: [ ] Todo, [~] In progress, [x] Done  
Owner: @assignee  
Effort: S (≤1d), M (2–3d), L (4–7d)

| ID | Task | Status | Owner | Effort |
| -- | ---- | ------ | ----- | ------ |
| 1 | Minimal Audit Logging | [x] |  | S |
| 2 | Server-side RBAC guard (core APIs) | [x] |  | S |
| 3 | 2FA (TOTP) backend | [ ] |  | S |
| 4 | Document validation + ownership + version | [x] |  | S |
| 5 | Payslip persistence + PDF | [ ] |  | M |
| 6 | Leave overlaps + notifications | [x] |  | S |
| 7 | Security headers + rate limits | [x] |  | S |
| 8 | Admin tiles (headcount/attendance) | [x] |  | S |
| 9 | User self-export | [ ] |  | S |
| 10 | Unified user façade | [ ] |  | M |
| 11 | Tenant scaffolding | [ ] |  | M |
| 12 | Onboarding checklists | [ ] |  | M |
| 13 | Document expiry reminders | [ ] |  | S |
| 14 | Bank info self-service w/ approval | [ ] |  | M |
| 15 | Attendance policy polish | [ ] |  | S |
| 16 | ATS MVP | [ ] |  | L |
| 17 | Performance MVP | [ ] |  | L |
| 18 | Shift policy + OT calculations | [ ] |  | L |

---

## Notes / Dependencies
- RBAC guard requires a small helper and role extraction from auth context (already available).  
- Payslip PDF can reuse existing UI template and `html-to-pdf` server-side render.  
- Notifications use email placeholders in settings; start with in-app and extend to SMTP later.  
- Tenant scaffolding should add `tenantId` on writes; do not block existing reads initially.


