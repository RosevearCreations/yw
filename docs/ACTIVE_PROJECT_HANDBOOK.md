# YWI Active Project Handbook

**Release:** `2026-09-01b`  
**Schema target:** `160`  
**Source authority:** `RosevearCreations/yw`  
**Active architecture:** Safety / OHSA, Finance, Jobs, Admin modules; I.T. Readiness is inside Admin.

## Current state

YW is an operations platform with public quote/SEO surfaces, staff workflows, a private customer portal, accounting/reconciliation, dispatch, job proof, supervisor closeout, customer notifications, and release-readiness controls. Schema 159 separated staff roles from module visibility. Schema 160 hardens that architecture and gives I.T./Admin one readiness cockpit rather than scattering preflight, preparedness, health, release, and recovery evidence across unrelated screens.

The existing supervisor closeout workflow still includes customer signoff, invoice readiness, review request handling, and maintenance follow-up. Customer/private workflows remain separate from public SEO.

## Module permissions

A profile receives one effective level per top-level module:

- `hidden` — module is absent and protected endpoints deny access.
- `view` — read-only module surfaces that require view.
- `create` — may capture/create module records where the existing role permits it.
- `approve` — may review/approve module records where the existing role permits it.
- `manage` — module administration/configuration, still subject to existing business rules.

Resolution order is profile override → role default. `admin` is a deliberate break-glass exception and always resolves to `manage` for every top-level module.

### Default role matrix

| Role | Safety / OHSA | Finance | Jobs | Admin |
| --- | --- | --- | --- | --- |
| Employee | create | hidden | create | hidden |
| Onsite Admin | create | hidden | create | hidden |
| Site Leader | approve | hidden | approve | hidden |
| Supervisor | approve | view | approve | hidden |
| HSE | manage | hidden | view | hidden |
| Job Admin | view | manage | manage | hidden |
| Admin | manage | manage | manage | manage |

The Admin module includes **Module Permissions** and **I.T. Readiness**. Module Permissions supports a Safety-only preset for non-admin profiles. Safety-only keeps Safety available at create and explicitly hides Finance, Jobs, and Admin.

### Admin access invariant

Schema 160 makes full Admin access a database invariant rather than a UI assumption:

- every active Admin resolves to `manage` on Safety, Finance, Jobs, and Admin;
- stale Admin profile overrides are removed during the migration;
- `trg_prevent_admin_module_override` blocks future Admin override inserts/updates;
- the Admin permission UI disables override controls for Admin targets;
- `v_admin_module_access_integrity` exposes service-side proof of the four effective levels;
- `ywi_it_readiness_security_assertions()` fails if any active Admin does not have full access.

Do not remove this break-glass behavior unless a replacement recovery authority exists.

## Module permission runtime

Schema 160 moves the Admin Module Permissions editor to a dedicated protected Edge Function:

- `admin-it-control` validates the JWT, loads the server-owned active `profiles` row, and requires `role=admin`;
- it does not use `user_metadata` or `app_metadata` as an authorization source;
- `module_permissions` returns active profiles, role defaults, overrides, audit rows, and Admin access-integrity evidence;
- writes use the atomic private RPC `ywi_admin_set_profile_module_permissions` instead of four independent browser writes;
- the write RPC is service-role-only and rejects Admin targets.

This dedicated control endpoint prevents the Module Permissions screen from depending on the large legacy `admin-directory` runtime.

## I.T. Readiness

**I.T. Readiness is an Admin `manage` sub-route, not a fifth top-level module.** It owns the operational question: “Are we prepared and ready to deploy/release safely?”

The current cockpit consolidates:

1. schema drift and database preflight;
2. module security and Admin access integrity;
3. deployment checklist and deployment gate;
4. required Edge Function readiness;
5. production/release readiness;
6. backup/restore preparedness;
7. runtime/error health and Admin tasks;
8. public SEO release checks;
9. authenticated browser smoke checks.

The I.T. cockpit is currently read-only for release decisions. It may show blockers/action hints and run safe browser smoke checks, but it must not auto-promote a release, bypass migration order, bypass Stripe/webhook truth, or weaken approval/privacy gates.

## Server boundaries

The browser filters the top module navigation and second-level section navigation. The server independently enforces permissions in the protected paths:

- Safety: form submission, log/detail review, review decisions, submission image upload, HSE packet proof.
- Jobs: Jobs directory/manage and Jobs-family Operations actions.
- Finance: accounting directory scopes, payment/reconciliation Operations actions, accountant exports; Finance data is redacted from Jobs payloads when Finance is hidden.
- Admin: Admin directory/selectors/manage operations, public media approval uploads, release/SEO/system Operations actions, module permission management, and I.T. readiness.

Existing role/rank gates remain in place for senior actions. Module permission does not turn an Employee into a Supervisor; it determines which business domain the Employee can enter.

## UI and responsive behavior

The signed-in top navigation remains exactly four modules. The second row shows only sections inside the active allowed module. For Admin, that second row now includes **Admin Control Center** and **I.T. Readiness**. Profile and Settings remain account utilities.

The I.T. cockpit uses contained cards and grids rather than a large pre-route static section. It includes 900px and 560px responsive breakpoints, full-width mobile actions, forced-colors support, and a truthful visual placeholder for a future Source → Database → Functions → Client → Release dependency map.

Visual placeholders remain intentional until approved original imagery/graphics are available. Private/customer job evidence is never automatically promoted to public SEO imagery.

## SEO boundary

Private Safety, Finance, Jobs, Admin, I.T. readiness, customer portal, job proof, costing, signoff, and notification pages are not SEO pages. Public route generation remains separately approved and follows the established one-H1, canonical, structured-data, image-alt, internal-link, and sitemap gates.

## Database authority

Apply migrations in order. Schema 159 adds the module registry and permission model. Schema 160 adds:

- Admin/manage route `it`;
- `it_readiness_check_registry`;
- `v_admin_module_access_integrity` (`security_invoker=true`);
- Admin override prevention trigger;
- `ywi_admin_set_profile_module_permissions` atomic service-role RPC;
- `ywi_it_readiness_security_assertions`;
- schema drift target 160.

Do not recreate or rename existing `v_schema_drift_status` columns out of order. Schema 160 preserves the existing view shape and advances only its expected schema marker.

## Current live control-plane evidence

On the connected YardWeasels Supabase project, migrations 159 and 160 have been applied. Read-only verification showed:

- schema drift `160 / 160`, current;
- I.T. route registered as Admin / manage;
- every Schema 160 I.T. security assertion passed;
- all active Admin profiles resolve to manage on all four modules;
- zero Admin access-integrity issues;
- `admin-it-control` is deployed with JWT verification enabled.

This is database/control-plane proof, not rendered browser acceptance.

## Release boundary

Before starting another major product feature, complete the authenticated Admin browser acceptance in `docs/NEXT_STEPS_AND_SANITY_CHECK.md`: Module Permissions must populate profiles; Admin targets must display immutable manage access on all four modules; I.T. Readiness must load; and a non-admin Safety-only fixture must still prove hidden navigation plus server-side denial.
