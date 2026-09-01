# Yard Weasels Inc. Operations Platform

**Current source handoff:** `2026-09-01b`  
**Database target:** schema `160`  
**Active documents:** this README, `docs/ACTIVE_PROJECT_HANDBOOK.md`, and `docs/NEXT_STEPS_AND_SANITY_CHECK.md`.

Schema 160 keeps the four top-level application modules introduced in schema 159 — **Safety / OHSA**, **Finance**, **Jobs**, and **Admin** — and adds **I.T. Readiness** as an Admin-only `manage` sub-section. I.T. Readiness is the control plane for preflight, preparedness, deployment readiness, database drift, function readiness, access integrity, backup/restore preparedness, runtime health, public SEO release checks, and browser smoke evidence.

The Admin **Module Permissions** manager is also repaired. It now uses the dedicated `admin-it-control` Edge Function instead of depending on the large legacy `admin-directory` payload. Active profiles are loaded from the server, permission changes are applied atomically through a private service-role RPC, and Admin profiles are permanent break-glass `manage` across all four modules.

## Module model

| Module | Purpose | Typical screens |
| --- | --- | --- |
| Safety / OHSA | Ontario workplace safety capture and review | Toolbox Talk, PPE, First Aid, Incident/Near Miss, Inspection, Drill, Logbook, Reports, Safety Operations |
| Finance | Commercial/accounting workflow | Accounting home, reconciliation, close, tax/payroll review, accountant handoff |
| Jobs | Field execution | Today, Crew, Jobs, Equipment, dispatch, proof, closeout |
| Admin | System control | People/access, Module Permissions, **I.T. Readiness**, configuration, integrations, media/SEO approval, release controls |

Each top-level module has one effective access level per profile: `hidden`, `view`, `create`, `approve`, or `manage`. Role still controls seniority inside an allowed module. Profile overrides control which modules exist for that person.

## I.T. Readiness

Admin → **I.T. Readiness** consolidates evidence from the existing operational control surfaces instead of creating another disconnected checklist. It summarizes:

- database schema drift and schema preflight;
- Admin/module access integrity and security assertions;
- deployment checklist and deployment gate status;
- required Edge Function readiness;
- production/release readiness;
- backup/restore rehearsal evidence;
- runtime/error health and Admin task inbox;
- public SEO release checks;
- authenticated browser smoke checks.

The I.T. screen is deliberately **readiness-first and non-destructive**. It reports blockers and action hints; it does not automatically release to Production or bypass review gates.

## Important security rules

- Hidden navigation is not authorization. Edge Functions also enforce module access.
- An active `admin` profile always resolves to break-glass `manage` for Safety, Finance, Jobs, and Admin.
- Schema 160 blocks per-profile module override rows for Admin profiles at the database level, so an Admin cannot accidentally lock out another Admin.
- Module permission writes are atomic and service-role-only through `ywi_admin_set_profile_module_permissions`.
- `admin-it-control` authorizes from the server-owned `profiles.role` row; user-editable auth metadata is not used for permission decisions.
- Jobs responses redact Finance-only arrays when Finance is hidden.
- Safety-only users can continue using permitted Safety forms while Finance, Jobs, and Admin APIs deny access.
- Customer portal routes remain token/private workflows and are not staff module permissions.
- Stripe paid status remains webhook-controlled.
- Public SEO routes remain separate from private staff/customer modules and still require approval, one H1, approved original images, descriptive alt text, canonical URLs, and sitemap approval.

## Schema 160 files

- `sql/159_module_boundaries_permission_gated_navigation.sql`
- `sql/160_it_readiness_admin_access_integrity.sql`
- `supabase/functions/_shared/module-permissions.ts`
- `supabase/functions/admin-it-control/index.ts`
- `js/security.js`
- `js/module-nav.js`
- `js/module-access-ui.js`
- `js/it-readiness-ui.js`
- `it-readiness.css`
- `scripts/admin-it-readiness-check.mjs`

The canonical reference `sql/000_full_schema_reference.sql` contains migrations 030 through 160 in order.

Historical Markdown is preserved under `retired-markdown-2026-08-05a/` and earlier dated archive folders. Do not treat archived files as current authority.

## Schema 163 Shared Core Data checkpoint — 2026-09-01e
- Shared Core now has one protected, read-only `core-data-read` directory for `profiles`, `clients`, `client_sites`, `jobs`, `equipment_master`, `customer_assets`, and `service_contract_documents`.
- Every read is bound to an authenticated active profile and the requesting Safety, Finance, Jobs, or Admin module must have `view` access.
- Browser Core data is cached by signed-in profile + module + entity set and is invalidated on sign-out/profile change/module-permission change.
- Schema 162 standalone business-module loading remains unchanged: business bundles are still fetched only after permission resolution.
- Schema 163 creates no replacement customer/job/person/site/equipment/asset/document tables.

## Schema 164 cross-module write-boundary checkpoint — 2026-09-01f
- The 35 explicitly handled `operations-manage` actions now have one fail-closed server contract declaring owner module, minimum module access, boundary mode, domain, and event key where applicable.
- Unknown actions no longer inherit Admin/manage access; they are rejected before any business handler runs.
- `deposit_status_update` is explicitly disabled at the boundary so hosted Stripe payment truth cannot be manually changed by staff actions.
- Declared cross-module effects emit private `module_boundary_events` metadata; request bodies are not copied into those events.
- Existing handler role checks remain as defense in depth, and Schema 163 Shared Core data remains read-only.
- Schema 164 creates no replacement customer, job, person, site, equipment, asset, or service-document identity tables.
