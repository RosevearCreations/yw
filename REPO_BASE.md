## 2026-04-08 landscaping/construction/mobile/admin-ui pathway documentation pass
- Refreshed the Markdown set to move the product direction from schema-only groundwork into the next implementation phase: admin UI managers for estimates/work orders, materials/units, routes/service areas, subcontract dispatch, and AR/AP + chart of accounts.
- Added a clearer rationale for keeping HSE as a first-class standalone module that can later link to jobs, sites, and dispatches for landscaping, project, and subcontract work.
- Updated the docs to emphasize mobile-first field use, desktop-strong admin depth, DB-first shared data, and local SEO / one-H1 discipline on every public build pass.

> Last synchronized: April 8, 2026. Reviewed during the estimates/work-orders/routes/materials/subcontract/general-ledger foundation and documentation synchronization pass.

# Repo Base

Last synchronized: April 8, 2026

## Active source of truth
Use this repository build as the current source of truth for the operations + HSE platform.

## Core direction
The repo is now centered on:
- landscaping operations
- project/construction support jobs
- subcontract dispatch jobs
- standalone and linked HSE workflows
- admin-managed shared reference data

## Current repo direction
The repo should now be treated as a landscaping / project-work / subcontract / HSE operations platform. Future passes should prefer DB-first shared data and admin managers over new JSON maps whenever the same values are used in more than one workflow.
