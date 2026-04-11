# Runbook: Auth Bootstrap

## April 10, 2026 note
- No auth bootstrap flow change in this pass. The relevant deployment dependency is that admin selectors/manage and schema migration 064 must stay in sync.

> Last synchronized: April 10, 2026. Reviewed during the receipt rollups, work-order operational status, posted/open amount visibility, and admin workflow sync pass.

## 2026-04-09 workflow rollups, posting, receiving-costing, and HSE closeout pass
- Added DB-first workflow logic so estimate, work-order, and material-receipt header totals can roll up from their line records instead of depending on manual entry.
- Added receivables/payables payment-application logic so invoices and bills can track paid amounts, remaining balance, and partial/paid status from posted payments.
- Added receiving-to-costing linkage so material receipt lines can feed received quantity / received cost visibility back into work-order execution.
- Extended linked HSE packets toward real progress and closeout handling with checklist-style completion fields, derived progress, and clearer Admin-side visibility.


## 2026-04-08 landscaping/construction/mobile/admin-ui pathway documentation pass
- Refreshed the Markdown set to move the product direction from schema-only groundwork into the next implementation phase: admin UI managers for estimates/work orders, materials/units, routes/service areas, subcontract dispatch, and AR/AP + chart of accounts.
- Added a clearer rationale for keeping HSE as a first-class standalone module that can later link to jobs, sites, and dispatches for landscaping, project, and subcontract work.
- Updated the docs to emphasize mobile-first field use, desktop-strong admin depth, DB-first shared data, and local SEO / one-H1 discipline on every public build pass.

> Last synchronized: April 8, 2026. Reviewed during the estimates/work-orders/routes/materials/subcontract/general-ledger foundation and documentation synchronization pass.

# Auth Bootstrap Runbook

Last synchronized: April 10, 2026

## Purpose
Use this runbook when a fresh Admin account or role reset is needed.

## Preferred remote-first approach
1. create the user in Supabase Auth dashboard
2. run the SQL promotion/update query in SQL Editor
3. verify `profiles.role`, `staff_tier`, and onboarding/account-setup timestamps

## Validation after bootstrap
- sign in
- confirm header identity
- confirm Settings data matches the same account
- confirm Admin selectors/jobs/staff screens load
- confirm logout works

## Current auth/runbook note
Auth stabilization remains important, but the next product-facing admin work is estimate/work-order, materials/units, routes/service areas, subcontract dispatch, and AR/AP + chart-of-accounts screens.

## 2026-04-10 crew assignment, recurring jobs, and field activity pass
- Job creation now has a clearer ownership path: a crew can be assigned at the same time as an explicit supervisor so responsibility is visible from the start.
- Jobs now support standalone or recurring scheduling fields, with recurrence summary/rule storage in the database instead of leaving schedule logic only in draft UI state.
- Job comments now have a DB-backed activity trail with optional photo attachments and special-instruction flags so crews and supervisors can review site notes, uploaded images, and field changes in one place.
- This pass continues the DB-first direction for shared operational data and reduces duplication risk compared with keeping crew/job packet details only in local JSON or loosely coupled browser state.
- Post-login runbook now also needs a quick jobs check: create/load a job, confirm crew/supervisor fields populate, and ensure job activity items render.
