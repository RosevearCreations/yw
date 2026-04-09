> Last synchronized: April 9, 2026. Reviewed during the deeper workflow polish pass for estimate/work-order lines, route stops, AR/AP payment posting, material receiving, linked HSE packets, and admin-manager alignment.

## 2026-04-08 landscaping/construction/mobile/admin-ui pathway documentation pass
- Refreshed the Markdown set to move the product direction from schema-only groundwork into the next implementation phase: admin UI managers for estimates/work orders, materials/units, routes/service areas, subcontract dispatch, and AR/AP + chart of accounts.
- Added a clearer rationale for keeping HSE as a first-class standalone module that can later link to jobs, sites, and dispatches for landscaping, project, and subcontract work.
- Updated the docs to emphasize mobile-first field use, desktop-strong admin depth, DB-first shared data, and local SEO / one-H1 discipline on every public build pass.

> Last synchronized: April 8, 2026. Reviewed during the estimates/work-orders/routes/materials/subcontract/general-ledger foundation and documentation synchronization pass.

# System Architecture

## April 9, 2026 architecture note
- Continue converging toward DB-first operational data for shared selectors, materials, equipment, estimates, work orders, dispatches, and accounting.
- Treat the HSE packet linkage as a join point between the standalone safety workflows and the formal operations/accounting backbone.


Last synchronized: April 8, 2026

## High-level architecture

The system is a browser-based operations and HSE application with:
- frontend SPA shell
- Supabase Auth
- Supabase database
- Supabase Edge Functions
- database-backed reference data and operational records
- service-worker shell caching

## Logical layers

### 1) Session and identity layer
Responsible for:
- login/logout
- onboarding completion
- effective role resolution
- preventing stale identity overwrites

### 2) Admin backbone layer
Responsible for:
- staff directory
- dropdown/reference values
- equipment catalog
- job/work-order control
- assignments and hierarchy

### 3) Field operations layer
Responsible for:
- jobs
- work orders
- equipment use
- routes/visits later
- materials/costing later

### 4) HSE layer
Responsible for:
- safety forms
- inspections/checks
- logbook/review
- standalone or linked use

## Architectural rule going forward

The HSE layer must be able to run standalone, but whenever a job/work-order/site exists, the system should be able to link the safety record back to operations cleanly.

## Next admin screen layer
- estimate / work-order manager
- materials + units manager
- route / service-area manager
- subcontract dispatch manager
- AR/AP + chart-of-accounts admin screens

These screens should be mobile-friendly for quick field edits and desktop-strong for office/admin work.

## April 8, 2026 architecture note
The architecture now has two equal centers:
1. Standalone-capable HSE field workflows for unscheduled and safety-only jobs.
2. Operations/accounting backbone records for estimates, work orders, routes, materials, equipment, subcontract dispatch, and digital accounting.

The system should continue linking these two centers without forcing every safety workflow to start from a formal office record.
