# YWI Active Project Handbook

**Release:** `2026-09-01a`  
**Schema target:** `159`  
**Source authority:** `RosevearCreations/yw`  
**Active architecture:** Safety / OHSA, Finance, Jobs, Admin modules.

## Current state

YW is an operations platform with public quote/SEO surfaces, staff workflows, a private customer portal, accounting/reconciliation, dispatch, job proof, supervisor closeout, customer notifications, and release-readiness controls. Schema 159 changes how authenticated staff access those capabilities: roles and modules are now separate concerns.
The existing supervisor closeout workflow still includes customer signoff, invoice readiness, review request handling, and maintenance follow-up; schema 159 changes access boundaries without removing those schema 158 capabilities.

### Module permissions

A profile receives one effective level per module:

- `hidden` — module is absent and protected endpoints deny access.
- `view` — read-only module surfaces that require view.
- `create` — may capture/create module records where the existing role permits it.
- `approve` — may review/approve module records where the existing role permits it.
- `manage` — module administration/configuration, still subject to existing business rules.

Resolution order is profile override → role default. Admin is a deliberate break-glass exception and always resolves to `manage`.

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

The Admin module includes a **Module Permissions** manager and a **Safety-only** preset. Safety-only keeps the target profile's current Safety capability (minimum create) and explicitly hides Finance, Jobs, and Admin.

## Server boundaries

The browser filters the top module navigation and second-level section navigation. The server independently enforces permissions in the main protected paths:

- Safety: form submission, log/detail review, review decisions, submission image upload, HSE packet proof.
- Jobs: Jobs directory/manage and Jobs-family Operations actions.
- Finance: accounting directory scopes, payment/reconciliation Operations actions, accountant exports; Finance data is redacted from Jobs payloads when Finance is hidden.
- Admin: Admin directory/selectors/manage operations, public media approval uploads, release/SEO/system Operations actions, module permission management.

Existing role/rank gates remain in place for senior actions. Module permission does not turn an Employee into a Supervisor; it determines which business domain the Employee can enter.

## UI and responsive behavior

The main signed-in navigation is now four modules. The second row shows only sections inside the active allowed module. Profile and Settings remain account utilities. Phone quick navigation is four module buttons. Existing dark theme/Operations Cockpit contrast safeguards remain.

Visual placeholders are intentionally used until approved original photography is available. Private/customer job evidence is never automatically promoted to public SEO imagery.

## SEO boundary

Private Safety, Finance, Jobs, Admin, customer portal, job proof, costing, signoff, and notification pages are not SEO pages. Public route generation remains separately approved and follows the established one-H1, canonical, structured-data, image-alt, internal-link and sitemap gates.

## Database authority

Apply migrations in order. Schema 159 adds:

- `app_modules`
- `app_module_routes`
- `app_role_module_permissions`
- `app_profile_module_permissions`
- `app_module_permission_audit`
- effective module permission RPCs and security assertions

Do not recreate or rename existing `v_schema_drift_status` columns out of order. Schema 159 preserves the existing view column shape and only advances the expected schema marker.

## Release boundary

Schema 159 is not production-proven merely because source checks pass. Before merging/deploying to Production, complete the Safety-only staging proof described in `docs/NEXT_STEPS_AND_SANITY_CHECK.md` and verify direct API denial as well as menu hiding.
