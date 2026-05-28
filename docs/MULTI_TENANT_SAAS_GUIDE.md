# Multi‑Tenant SaaS Migration Guide (KaystoneHR)

This guide explains how to evolve this Next.js + Firebase/Firestore + Supabase + MongoDB project into an enterprise-grade, multi-tenant SaaS (GHL-like) with tenant isolation, customization, billing, and observability.

Audience: engineering leads and contributors shipping the migration incrementally.

---

## 0) Current baseline (context)
- Next.js App Router (`app/`) + API routes
- Firebase Auth + Firestore (primary data)
- Supabase Storage (documents) + setup script
- MongoDB (select sync/analytics)
- Electron app + Chrome extension (optional clients)
- Not tenant-aware yet

Principles for this migration:
- Shared app, logically isolated data per tenant
- Server-enforced authorization; client hints only
- Incremental rollout: one vertical at a time (attendance → payroll → tasks → …)

---

## 1) Core data model (Firestore-first)
Two supported layouts. Prefer hierarchical for simpler rules and pruning:

Option A (hierarchical):
- `tenants/{tenantId}`
  - `settings/{singleton}`: branding, flags, custom fields
  - `memberships/{userId}`: roles, status
  - Business subcollections: `attendance`, `employees`, `payroll`, `tasks`, `documents`, `auditLogs`, …

Option B (flat with tenantId field):
- Collections like `attendance` with a required `tenantId` field, composite indexes; rules must filter by `tenantId`.

Recommended collections:
- `tenants`: `{ id, slug, name, createdAt, subscription, limits }`
- `tenantMemberships`: `{ tenantId, userId, roles: string[], status }`
- `tenantSettings`: `{ tenantId, branding, featureFlags, customFields, policies }`
- `tenantDomains`: `{ tenantId, domain, verified, createdAt }`
- `auditLogs` per tenant

Add indexes:
- For flat collections: `{ tenantId: 1, createdAt: -1 }` and hot query combos

---

## 2) Tenant resolution (subdomain and path)
Support both for flexibility:
- Subdomain: `acme.yourapp.com`
- Path fallback: `yourapp.com/t/acme/...`

Middleware shape (conceptual):
```ts
// middleware.ts (concept)
export function middleware(req) {
  const url = new URL(req.url);
  const host = req.headers.get('host') || '';
  const base = process.env.BASE_DOMAIN || 'yourapp.com';
  const sub = host.endsWith(base) ? host.replace(`.${base}`, '') : null;
  const parts = url.pathname.split('/').filter(Boolean);
  const pathTenant = parts[0] === 't' ? parts[1] : null;
  const tenantSlug = sub && sub !== base ? sub : pathTenant || null;
  // Attach to request context (NextRequest attribute or header)
  return NextResponse.next();
}
```

Server helpers:
- `lib/tenancy/get-tenant.ts`: resolve slug → tenant
- `lib/tenancy/require-tenant.ts`: throw if absent; return `{ id, slug, settings }`

API usage:
```ts
// app/api/.../route.ts (concept)
export async function GET(req: Request) {
  const tenant = await requireTenant(req);
  const data = await serviceMethod(tenant.id, params);
  return Response.json({ data });
}
```

---

## 3) Security rules (Firestore) – tenant isolation
Prefer hierarchical security:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isMember(tenantId) {
      // Example membership doc per user per tenant
      return exists(/databases/$(database)/documents/tenantMemberships/$(request.auth.uid + '_' + tenantId));
    }

    match /tenants/{tenantId}/{document=**} {
      allow read, write: if request.auth != null && isMember(tenantId);
    }

    // Optional: protect direct tenant doc
    match /tenants/{tenantId} {
      allow read: if false;
      allow write: if false;
    }
  }
}
```

If using flat collections, enforce `request.resource.data.tenantId == resource.data.tenantId == currentTenantId` and validate `isMember(tenantId)`.

Storage (Supabase):
- Use folder prefixes `tenants/{tenantId}/...`
- Add app-side checks to ensure callers can only operate within their tenant prefix

---

## 4) Backend service layer
Add a thin service layer under `services/` that always takes `tenantId`:
- `services/attendance/*`
- `services/payroll/*`
- `services/tasks/*`
- `services/tenants/*`

Patterns:
```ts
// services/payroll/get-payslips.ts (concept)
export async function getPayslips(tenantId: string, filters: { employeeId?: string }) {
  // Query `tenants/${tenantId}/payslips` or flat with where('tenantId', '==', tenantId)
}
```

Authorization helpers:
- `lib/tenancy/authorize.ts`: `requireRole(tenantId, userId, roles: string[])`
- Centralize all role checks

---

## 5) Frontend: tenant context, branding, and features
Introduce a `TenantProvider` (server-fetched) and expose settings via context:
- Inject CSS variables for brand color, typography in `app/layout.tsx`
- Replace static logos and favicons with tenant-configured URLs
- Feature flags component:
```tsx
export function FeatureGate({ flag, children }: { flag: string; children: React.ReactNode }) {
  const { settings } = useTenant();
  if (!settings?.featureFlags?.[flag]) return null;
  return <>{children}</>;
}
```

Custom fields:
- Store JSON schema per module in `tenantSettings.customFields`
- Render extra fields in forms and tables dynamically

Routing:
- All links should be tenant-relative (respect subdomain or `/t/[slug]`)

---

## 6) Billing and plans (Stripe)
- Stripe product → feature bundle and limits
- Store subscription on `tenants/{tenantId}`: `{ plan, status, seats, renewsAt }`
- Webhook → update tenant record and set feature flags/limits
- Enforce limits in service layer and UI

---

## 7) Custom domains and subdomains
- `tenantDomains`: `{ tenantId, domain, verified }`
- DNS verification via TXT record
- Configure wildcard subdomains on hosting (e.g., Vercel) and add domain routing
- Map incoming host → tenant via `tenantDomains`

---

## 8) Observability and compliance
- Per-tenant audit logs: `tenants/{tenantId}/auditLogs`
- Error tracking with `tenantId` tag
- Rate limiting per tenant in API routes (e.g., IP + tenant key)
- Data export per tenant (CSV/JSON), right-to-erasure
- Backups and restore runbooks

---

## 9) Electron app and Chrome extension
- Include `tenantId` in their auth/session context
- Send `X-Tenant-Id` header or use tenant-aware API paths
- Store and remember last tenant; allow tenant switch
- Storage uploads must write to `tenants/{tenantId}/...`

---

## 10) Environment and secrets
Required additions:
- `BASE_DOMAIN=yourapp.com`
- `NEXT_PUBLIC_STORAGE_PROVIDER=supabase` (already supported)
- Stripe keys for billing (when enabled)

Secrets policy:
- Do NOT commit long-lived private keys in `.env.local`
- Rotate any leaked Firebase Admin private key
- Use platform secrets (Vercel/Render/GCP) and CI secrets

---

## 11) MongoDB usage
If you keep MongoDB for analytics/archival:
- Add `tenantId` to all documents
- Indexes: `{ tenantId: 1, createdAt: -1 }` plus hot filters
- Batch jobs must always scope by tenant

Optionally plan a phase-2 migration to Postgres + Prisma for strict RLS; not required to ship multi-tenancy now.

---

## 12) Incremental migration plan (suggested)
Phase 0 – Foundation (1–2 days)
- Add `tenants`, `tenantMemberships`, `tenantSettings`
- Implement middleware tenant resolution
- Create `lib/tenancy/{get-tenant,require-tenant,authorize}.ts`
- Add Firestore rules for hierarchical model

Phase 1 – One vertical end-to-end (attendance) (2–5 days)
- Move attendance data under `tenants/{tenantId}/attendance`
- Update API routes to require tenant and check membership
- Update UI data hooks to use tenant context
- Add minimal branding (logo, colors) and feature flags

Phase 2 – Extend to payroll and tasks (1–2 weeks)
- Repeat the pattern; migrate data with a one-time script
- Add per-tenant audit logs

Phase 3 – Billing and domains (1 week)
- Add Stripe integration and webhooks → update `tenant.subscription`
- Add `tenantDomains` and domain verification flow

Phase 4 – Hardening (ongoing)
- Rate limits, observability, SLOs
- Backups and export tooling

---

## 13) Migration checklists
Pre-flight
- [ ] Base domain configured and resolvable
- [ ] Tenant resolution returns a valid `tenantId`
- [ ] Firestore rules deployed for tenant isolation
- [ ] At least one tenant seeded with admin user

Vertical conversion (repeat per module)
- [ ] Data model updated (`tenants/{tenantId}/<module>`)
- [ ] API routes require tenant + authorization
- [ ] UI reads from tenant context and respects feature flags
- [ ] Backfill/migrate existing data with idempotent script

Security
- [ ] Secrets not committed; admin key rotated if leaked
- [ ] Admin-only operations gated by role
- [ ] Audit logs emitted for sensitive actions

Readiness
- [ ] Load test with N tenants and realistic data sizes
- [ ] Error tracking shows `tenantId`
- [ ] Backup/restore drill completed

---

## 14) Example env template
```
# Base
NEXT_PUBLIC_APP_NAME=KaystoneHR
BASE_DOMAIN=yourapp.com

# Firebase (client)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (server) – set in platform secrets, not committed
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# Storage
NEXT_PUBLIC_STORAGE_PROVIDER=supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Billing (optional until enabled)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

---

## 15) Dev tasks you can start now
- Create collections: `tenants`, `tenantMemberships`, `tenantSettings`
- Implement middleware to populate tenant slug
- Add `TenantProvider` and swap header/logo to tenant branding
- Convert one API route (attendance list) to `requireTenant`
- Deploy updated Firestore rules

Once the above is done, use the attendance module as a reference to convert the rest.

---

Questions or decisions to make early:
- Hierarchical vs flat collection model? (Recommend hierarchical)
- Role matrix: what roles and which actions per module?
- Default features per plan (map to flags/limits)?

Ship small, verify, then expand.





























