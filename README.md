# Yard Weasels Inc. Operations Platform

**Current source handoff:** `2026-09-01a`  
**Database target:** schema `159`  
**Active documents:** this README, `docs/ACTIVE_PROJECT_HANDBOOK.md`, and `docs/NEXT_STEPS_AND_SANITY_CHECK.md`.

Schema 159 introduces real top-level application modules so login access can be limited independently from staff seniority. The four modules are **Safety / OHSA**, **Finance**, **Jobs**, and **Admin**. A profile can now be Safety-only: Finance, Jobs, and Admin disappear from navigation and their protected server functions deny direct access as well.

## Module model

| Module | Purpose | Typical screens |
| --- | --- | --- |
| Safety / OHSA | Ontario workplace safety capture and review | Toolbox Talk, PPE, First Aid, Incident/Near Miss, Inspection, Drill, Logbook, Reports, Safety Operations |
| Finance | Commercial/accounting workflow | Accounting home, reconciliation, close, tax/payroll review, accountant handoff |
| Jobs | Field execution | Today, Crew, Jobs, Equipment, dispatch, proof, closeout |
| Admin | System control | People/access, configuration, integrations, media/SEO approval, release readiness |

Each module has one effective access level per profile: `hidden`, `view`, `create`, `approve`, or `manage`. Role still controls seniority inside an allowed module. Profile overrides control which modules exist for that person.

## Important security rules

- Hidden navigation is not authorization. Edge Functions also enforce module access.
- Admin profiles retain break-glass `manage` access to all modules so an administrator cannot lock out all administrators.
- Jobs responses redact Finance-only arrays when Finance is hidden.
- Safety-only users can continue using their permitted Safety forms while Finance, Jobs, and Admin APIs deny access.
- Customer portal routes remain token/private workflows and are not staff module permissions.
- Stripe paid status remains webhook-controlled.
- Public SEO routes remain separate from private staff/customer modules and still require approval, one H1, approved original images, descriptive alt text, canonical URLs, and sitemap approval.

## Schema 159 files

- `sql/159_module_boundaries_permission_gated_navigation.sql`
- `supabase/functions/_shared/module-permissions.ts`
- `js/security.js`
- `js/module-nav.js`
- `js/finance-ui.js`
- `js/module-access-ui.js`

The canonical reference `sql/000_full_schema_reference.sql` contains migrations 030 through 159 in order.

Historical Markdown is preserved under `retired-markdown-2026-08-05a/` and earlier dated archive folders. Do not treat archived files as current authority.
