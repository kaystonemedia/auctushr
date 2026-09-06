# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

AuctusHR (formerly "KayStoneHR") is a Next.js 15 (App Router) HR management system — employee management, attendance/monitoring, leave, payroll (Paystack), performance, and productivity tracking. It ships three ways: as a web app (Vercel), as an Electron desktop shell that wraps the deployed web app in a `BrowserWindow` for activity/screenshot monitoring, and as a browser extension for attendance tracking (`chrome-extension/`, `extension/`).

## Commands

```bash
npm run dev                 # Next.js dev server (localhost:3000)
npm run build                # Production build (standalone output)
npm run lint                 # next lint

npm run electron:dev         # Runs `next dev` + electron concurrently against localhost
npm run electron:build       # Builds Next.js with BUILD_TARGET=electron (static export to out/) then electron-builder
npm run electron:dist        # Same as above but --publish=never (local package only, no publish)

npm run setup:supabase       # node setup-supabase.js — provisions Supabase schema/storage
```

There is no test runner configured (no Jest/Vitest/Playwright, no `test` script).

`next.config.js` and `next.config.ts` both exist; both set `typescript.ignoreBuildErrors: true` and `eslint.ignoreDuringBuilds: true` — **`npm run build` succeeding does not mean the code typechecks**, run `tsc --noEmit` or read errors from your editor if you need real type safety. ESLint rules for unused vars, `no-explicit-any`, and exhaustive-deps are also turned off project-wide (`.eslintrc.json`).

## Architecture

### Backend: Supabase, behind a Firestore-shaped shim

The **real** backend is Supabase (Postgres + Supabase Auth), configured via `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` (see `.env.example`). The app was migrated off Firebase, but most feature code still calls a **Firestore-API-compatible shim** rather than Supabase's query builder directly, so don't be misled by `collection()`/`doc()`/`getDocs()`/`onAuthStateChanged()`-style calls into thinking Firebase is in use:

- `lib/data/firestore.ts` — implements `collection`, `doc`, `query`, `where`, `orderBy`, `limit`, `getDocs`, `getDoc`, `addDoc`, `setDoc`, `updateDoc`, `deleteDoc`, `onSnapshot` (polls every 10s), `Timestamp`, `serverTimestamp`, `arrayUnion`, `writeBatch` — all backed by `supabaseClient` (`lib/supabase/client.ts`). It maps Firestore "collection" names to real Postgres tables (`COLLECTION_TABLE_MAP`) and translates between camelCase Firestore-style fields and snake_case Postgres columns per-table (`TABLE_FIELD_TO_DB` / `TABLE_FIELD_FROM_DB`, plus per-table column allowlists that stash unknown fields into a `metadata` jsonb column).
- `lib/data/auth.ts` — a Firebase Auth-shaped client (`getAuth`, `onAuthStateChanged`, `signInWithEmailAndPassword`, `signOut`, etc.) that actually calls the app's own `/api/auth/*` routes and Supabase Auth.
- `lib/data/identity.ts` — caches a mapping from Supabase `auth.users.id` (the "uid") to `profiles.id` (the "profileId"), since legacy code often has one and needs the other for FK columns.
- `lib/firebase.ts` / `lib/firebase-admin.ts` — client/server compat shims re-exporting the above under Firebase-like names (`initializeApp`, `adminDb`, `getAdminDb()`, etc.) so old imports keep working. `lib/firebase-admin.ts`'s `db.collection(x).doc(id).set/get()` wraps `supabaseAdmin` (service-role client).
- `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `functions/` are **leftovers from the pre-migration Firebase backend** — not part of the active data path. Root docs like `README.md`, `DEPLOYMENT.md`, and `BUILD_FIXES_REFERENCE.md` are stale and describe the old Firebase setup; treat `.env.example` and the code under `lib/` as the source of truth instead.

When adding new server-side data access, prefer calling `supabaseAdmin` (`lib/supabase/admin.ts`) directly rather than routing through the Firestore shim, unless you're extending an existing shim-based module for consistency.

### Auth

- Session lives in a `sb-access-token` cookie (Supabase access token). Requests can also pass `Authorization: Bearer <token>`.
- `middleware.ts` rate-limits `/api/*` and redirects unauthenticated page requests to `/auth/sign-in`, but does **not** verify the token or enforce roles itself — API routes must call `authenticateRequest`/`requireRole` from `lib/api-auth.ts`, and pages rely on the client-side auth context to redirect on missing/invalid role.
- `lib/api-auth.ts` — `authenticateRequest(request)` and `requireRole(request, roles)` resolve a Supabase access token to a `profiles` row via `supabaseAdmin`, returning `{ uid, role, department, managerId, profileId }`. Use these in every new `app/api/**/route.ts` that needs auth.
- `lib/auth.ts` — `getServerSession()` is the server-component equivalent (reads the same cookie).
- Client-side: `contexts/new-auth-context.tsx` (`NewAuthProvider`/`useNewAuth`) is the real, actively-used auth provider (69+ call sites); `contexts/auth-context.tsx` (`AuthProvider`/`useAuth`) is a thin wrapper around it exposing a `User`/`hasPermission` shape (uses `ROLE_PERMISSIONS` from `types/user.ts`). Roles are `admin | manager | employee`.
- Note: `contexts/new-auth-context.tsx` contains a large commented-out block near the end (old direct-Firestore implementation) — ignore it, only the top of the file (starting `'use client'` at line 1) is live code.

### App Router structure

- `app/api/**` — route handlers, grouped by feature (`attendance`, `payroll`, `leave`, `tasks`, `monitoring`, `productivity`, `performance`, `gamification`, `tools`, `webhooks/paystack`, etc.). Many `app/api/payroll/test-*` and `app/api/*/test*` routes are ad hoc debugging endpoints left in the tree, not part of the product surface — be cautious about relying on them.
- `app/(pages)` — role-aware pages under `app/dashboard/{admin,manager,employee}`, plus a parallel, older `app/main/dashboard/{admin,manager,employee}` tree; check which one is actually linked/navigated to before editing — don't assume both are live.
- `app/components`, `app/contexts` — app-scoped duplicates of the root `components/` and `contexts/` directories exist; check import paths (`@/components/...` vs `@/app/components/...`) carefully when editing shared UI.
- `components/ui` — shadcn/ui primitives (`components.json`: style "new-york", base color "neutral", icon library lucide). Feature components are organized by domain (`components/payroll`, `components/attendance`, `components/tasks`, `components/monitoring`, `components/electron`, etc.).
- `types/` — one file per domain (`employee.ts`, `payroll.ts`, `attendance.ts`, `leave.ts`, `performance.ts`, `productivity.ts`, `user.ts` with `ROLE_PERMISSIONS`, `database.ts` for Supabase table shapes).

### Electron shell

- `electron/main.js` — Electron entry point (`package.json` `main`). Loads either `http://localhost:3000` (dev) or the deployed URL (`NEXT_PUBLIC_APP_URL`, default `https://auctushr.vercel.app`) into a `BrowserWindow`; not a static bundle of the Next app. Handles tray icon, screenshot capture (`screenshot-desktop`), activity/idle tracking, and syncs auth via `electron/supabase-session.js`.
- `electron:build`/`electron:dist` set `BUILD_TARGET=electron`, which switches `next.config.ts`'s `output` to `'export'` and `distDir` to `out/` (vs. `'standalone'`/`.next` for the web build), and externalizes native modules (`active-win`, `screenshot-desktop`, `iohook`, `electron-store`) from the client webpack bundle.
- `electron/dist/*.exe` (NSIS installers) are intentionally committed (see `.gitignore` allowlist) so the team can distribute the desktop app without rebuilding.

### Payments

Paystack integration (`lib/paystack-integration.ts`, `lib/generic-payment-service.ts`, `app/api/payroll/paystack/**`, `app/api/webhooks/paystack/route.ts`) drives payroll disbursement; see `paystack.md` for provider-specific notes.
