# Tasks Module Roadmap (Minimal, Outstanding, Productivity-Driven)

This TODO roadmap blends clarity/accountability with integrated productivity scoring. It fits the existing Firestore + Next.js architecture and reuses your monitoring stack.

## Principles
- [ ] Clarity over complexity (minimal options, high signal)
- [ ] Accountability (ownership, timestamps, progress)
- [ ] Direct productivity tie-in (event-driven scoring)
- [ ] Progressive enhancement (ship core fast, layer depth later)

---

## Phase 0 — Decision & Audit
- [ ] Decide single source of truth for tasks: Firestore `tasks` collection
- [ ] Choose scoring path: Cloud Function on `tasks/{taskId}` writes (preferred) or API route wrappers
- [ ] Inventory current flows and callers
  - [ ] `app/tasks/page.tsx`, `components/tasks/*`
  - [ ] `components/productivity/task-manager.tsx` (to deprecate/merge)
  - [ ] `lib/productivity.ts`, `lib/unified-monitoring-service.ts`, `lib/automated-kpi-calculator.ts`
- [ ] Document deprecation plan for duplicated TaskRecord definitions

### Acceptance
- [ ] One-page decision: Cloud Function vs API
- [ ] Map of files to touch and what gets removed/merged

---

## Phase 1 — Data Model Consolidation
- [ ] Unify `Task` type (canonical) in `types/task.ts`
  - [ ] Merge fields from `types/productivity.ts` `TaskRecord`
  - [ ] Fields: `title, description, priority('low'|'medium'|'high'|'urgent'), status('backlog'|'accepted'|'in_progress'|'in_review'|'blocked'|'completed'|'cancelled'), dueDate, assignees[], assignerId/Name, projectId, milestoneId, parentTaskId, dependencies[], watchers[]`
  - [ ] Tracking: `estimatedHours, actualHours, progress(0-100)`
  - [ ] Timestamps: `assignedAt, acceptedAt, startedAt, inReviewAt, completedAt, blockedAt, updatedAt`
- [ ] Time tracking subcollection: `tasks/{taskId}/timeEntries` with `{ start, end, createdBy }`
- [ ] Productivity logs:
  - [ ] `productivityLogs/{userId}/events` { taskId, action, meta, scoreChange, timestamp }
  - [ ] `productivityDaily/{userId}/{YYYY-MM-DD}` { taskScore, monitoringScore, blendedScore, aggregates }
- [ ] Firestore indexes
  - [ ] Composite: `(status, assigneeId)`, `(projectId, status)`
  - [ ] Single-field: `dueDate`, `priority`
- [ ] Migration/backfill
  - [ ] Map statuses: `pending→backlog`, keep `in_progress`, add `in_review`, `blocked`, `cancelled`, `completed`
  - [ ] Backfill missing timestamps conservatively
  - [ ] Remove/alias duplicate `TaskRecord` definitions

### Acceptance
- [ ] Single `Task` interface used across codebase
- [ ] Existing pages render without errors using new fields
- [ ] Indexes deployed (`firestore.indexes.json` updated as needed)

---

## Phase 2 — Scoring Engine (Event-Driven)
- [ ] Add `lib/score-engine.ts`
  - [ ] `applyTaskEventDelta(userId, task, eventType, context)` returns `{ scoreChange, reasons }`
  - [ ] Priority weights: low=0.8, medium=1.0, high=1.2, urgent=1.5
  - [ ] Rules (defaults):
    - [ ] accept: +1
    - [ ] start_within_24h_of_assign: +2
    - [ ] complete_base: `ceil(estimatedHours) * priorityWeight`
    - [ ] on_time_bonus: +20% of base
    - [ ] early_bonus: +30% of base
    - [ ] overdue_penalty: −30% base per day (capped)
    - [ ] reopen_penalty: −25% base
    - [ ] blocked_gt_24h_penalty: −2/day
    - [ ] time_drift_penalty when `actual > 1.5×estimated`: −20% base
- [ ] Compute blend: `blended = clamp(0..100, 0.6*monitoring + 0.4*taskScore)`
- [ ] Cloud Function `onWrite('tasks/{taskId}')`
  - [ ] Diff status/timestamps → derive `eventType`s
  - [ ] Write events to `productivityLogs`
  - [ ] Update `productivityDaily` aggregates idempotently
- [ ] Fill `lib/productivity.ts#calculateProductivityScore` to read daily aggregates
- [ ] Admin-tunable weights: `settings/productivityWeights` doc

### Acceptance
- [ ] Task state changes create event logs and update daily aggregates
- [ ] Daily productivity reflects blended score

---

## Phase 3 — Employee Inbox (My Tasks)
- [ ] Enhance `app/my-tasks/page.tsx`
  - [ ] Sort: due soon → priority → backlog
  - [ ] Quick filters (status, priority, project)
  - [ ] Batch actions (accept, start, complete)
- [ ] Update `components/tasks/task-list.tsx`
  - [ ] Inline actions: Accept/Start/Block/In Review/Complete
  - [ ] SLA chips (dueSoon/overdue), progress bar, priority color
- [ ] Add `components/tasks/task-drawer.tsx`
  - [ ] Description, milestones, subtasks, dependencies, attachments, comments
  - [ ] Time tracking (Start/Pause/Resume/Stop) → `timeEntries`
- [ ] Add `components/tasks/productivity-widget.tsx`
  - [ ] Daily score, streak, today’s task delta

### Acceptance
- [ ] End-to-end task execution updates productivity and UI in near-real-time

---

## Phase 4 — Manager Assignment & Overview
- [ ] Enhance `components/tasks/create-task-modal.tsx`
  - [ ] Multi-assignee, milestones, watchers, estimatedHours, dependencies
  - [ ] Notifications on assignment
- [ ] Manager dashboard (new)
  - [ ] Completion rate, on-time %, blocked count, cycle time
  - [ ] Team workload heatmap (per assignee)
- [ ] Notifications expansion (due-soon, overdue, status changes, mentions)

### Acceptance
- [ ] Managers can assign with clarity and see team progress & bottlenecks

---

## Phase 5 — Views: Kanban + Calendar
- [ ] `components/tasks/kanban-board.tsx` (Backlog → In Progress → Review → Done)
  - [ ] Drag-and-drop updates status and timestamps
- [ ] `components/tasks/calendar-view.tsx` (deadline view)
  - [ ] Reschedule via drag; dueSoon color cues
- [ ] Toggle views in `app/tasks/page.tsx`

### Acceptance
- [ ] Smooth view switching; drag/drop triggers scoring events

---

## Phase 6 — Milestones, Subtasks, Dependencies
- [ ] Subtasks via `parentTaskId`; progress rolls up by completion %
- [ ] Milestone checklist with optional weights → contributes to `progress`
- [ ] Dependency guards (cannot start until predecessors complete)

### Acceptance
- [ ] Progress reflects subtasks/milestones; dependency constraints enforced

---

## Phase 7 — Notifications & Reminders
- [ ] Due-soon (24h) reminders to assignees
- [ ] Overdue daily nudges to assignees + notify assigner/watchers
- [ ] Blocked >24h weekly digest for managers
- [ ] Idempotency keys to avoid spam

### Acceptance
- [ ] Reliable, concise notifications with clear copy

---

## Phase 8 — Reporting & HR Integration
- [ ] `/reports/productivity` page
  - [ ] Per-user trends, team aggregates
  - [ ] Correlate task score vs monitoring score
- [ ] Integrate with `lib/automated-kpi-calculator.ts` (task KPIs)
- [ ] Admin UI to tune `score-engine` weights

### Acceptance
- [ ] Managers get actionable insights; KPIs include task performance

---

## Phase 9 — Gamification Polish (Subtle)
- [ ] Streaks for on-time completion
- [ ] Badges: high-priority wins, unblocker helper credit
- [ ] Optional kudos/recognition

### Acceptance
- [ ] Visible but non-intrusive motivation drivers

---

## Phase 10 — QA, Pilot, Iteration
- [ ] Pilot with selected teams; gather feedback on fairness and UX
- [ ] Adjust weights for task size/complexity; add size tags if needed
- [ ] Harden Firestore security rules and role checks
- [ ] Load-test queries and composite indexes

### Acceptance
- [ ] Stabilized release criteria met; rollout plan finalized

---

## API Endpoints (if not using Cloud Functions exclusively)
- [ ] `POST /api/tasks` — create task
- [ ] `GET /api/tasks` — list (filters: status, assigneeId, projectId, due range)
- [ ] `PATCH /api/tasks/:id` — update status/fields (emits scoring events)
- [ ] `POST /api/tasks/:id/progress` — update milestones/subtasks/progress
- [ ] `POST /api/tasks/:id/time` — start/stop time entry
- [ ] `GET /api/reports/productivity` — aggregates for manager dashboards

---

## File Touchpoints
- [ ] `types/task.ts` — unify model
- [ ] `lib/score-engine.ts` — new scoring service
- [ ] `lib/productivity.ts` — implement `calculateProductivityScore`
- [ ] `functions/src/index.ts` — Cloud Function on `tasks/{taskId}` write
- [ ] `app/tasks/page.tsx` — view toggle, filters
- [ ] `components/tasks/task-list.tsx` — inline actions, SLA chips
- [ ] `components/tasks/task-drawer.tsx` — details, time tracking
- [ ] `components/tasks/create-task-modal.tsx` — manager assignment upgrades
- [ ] `components/tasks/kanban-board.tsx` — new
- [ ] `components/tasks/calendar-view.tsx` — new
- [ ] `components/tasks/productivity-widget.tsx` — new
- [ ] Deprecate/merge `components/productivity/task-manager.tsx`

---

## Event Taxonomy (for scoring)
- [ ] `accepted`
- [ ] `started`
- [ ] `moved_to_review`
- [ ] `completed`
- [ ] `reopened`
- [ ] `blocked` / `unblocked`
- [ ] `overdue_tick`
- [ ] `on_time_bonus` / `early_bonus`
- [ ] `time_drift_penalty`

---

## Permissions Matrix (summary)
- [ ] Admin/Manager: assign, edit, set review/complete, view all
- [ ] Employee: accept, start/pause/complete own, comment, upload attachments
- [ ] Watchers: receive notifications, view task

---

## Definition of Done (per phase)
- [ ] All acceptance boxes checked
- [ ] No new linter errors
- [ ] Firestore rules updated
- [ ] Indexes deployed and verified
- [ ] Basic e2e happy-path tested









