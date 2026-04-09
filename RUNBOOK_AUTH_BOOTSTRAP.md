> Last synchronized: April 9, 2026. Reviewed during the workflow rollups, payment posting, receiving-to-costing, and HSE packet closeout pass.

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

Last synchronized: April 8, 2026

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