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

# AI Context

Last synchronized: April 8, 2026

## What this project is now
Treat the product as a landscaping-led field operations platform with integrated HSE capabilities.

## Core business modes
- recurring landscaping operations
- project/construction-style jobs
- subcontract dispatch work
- standalone HSE workflows

## What future passes should prefer
- database-backed shared operational data
- mobile-first field UX
- desktop-strong admin depth
- stable session identity above all other feature work

## Current planning note
When continuing this project, assume the next strongest implementation pass is the admin UI layer on top of the new operations/accounting tables, while keeping HSE standalone-friendly and mobile-first.