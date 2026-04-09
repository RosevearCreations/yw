> Last synchronized: April 8, 2026. Reviewed during the Admin backbone manager, HSE/OSHA hub, and operations/accounting UI pass.

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
