> Last synchronized: April 9, 2026. Reviewed during the workflow rollups, posting logic, receiving-to-costing, and HSE closeout pass.

## 2026-04-09 workflow rollups / posting / costing / HSE closeout pass
- Added migration `063_workflow_rollups_posting_and_hse_closeout.sql` for database-enforced line totals, estimate/work-order rollups, AR/AP balance updates, receiving-to-costing linkage, and linked HSE packet closeout fields.
- Extended the Admin backbone manager so it previews derived totals, suggests payment posting amounts from balances, shows route/receipt rollups, and surfaces HSE completion/closeout progress in the UI.
- Refreshed the schema snapshot, smoke-check reference, metadata/cache strings, and Markdown set to align the repo around the new workflow-enforcement direction.


## 2026-04-08 landscaping/construction/mobile/admin-ui pathway documentation pass
- Refreshed the Markdown set to move the product direction from schema-only groundwork into the next implementation phase: admin UI managers for estimates/work orders, materials/units, routes/service areas, subcontract dispatch, and AR/AP + chart of accounts.
- Added a clearer rationale for keeping HSE as a first-class standalone module that can later link to jobs, sites, and dispatches for landscaping, project, and subcontract work.
- Updated the docs to emphasize mobile-first field use, desktop-strong admin depth, DB-first shared data, and local SEO / one-H1 discipline on every public build pass.

## 2026-04-07 estimates/work-orders/routes/materials/subcontract/GL foundation pass
- Added migration `061_estimates_work_orders_routes_materials_and_gl_foundation.sql` with foundational tables for clients, client sites, service areas, routes, route stops, units of measure, materials catalog, equipment master data, estimates, work orders, subcontract dispatch, chart of accounts, AR, AP, and GL journals.
- Refreshed the schema reference snapshot so the latest schema files reflect the new accounting/operations foundation.
- Rewrote the roadmap, gaps/risk docs, project-state docs, and database docs so the next build phase is clearly focused on the digital admin/operations/accounting backbone.

# Changelog

## 2026-04-09 deeper workflow polish preparation pass
- Added migration `062_deeper_workflow_polish_admin_foundation.sql` for material receipts, material receipt lines, and linked HSE packets.
- Extended the Admin backend and selectors toward route stops, estimate/work-order lines, AR/AP payments, material receiving, and linked HSE packets.
- Updated the documentation set to describe why OSHA- and IRS-aligned operations/accounting + HSE linkage is the right next direction.


Last synchronized: April 8, 2026


## 2026-04-08 landscaping/construction/mobile/admin-ui pathway documentation pass
- Refreshed the Markdown set so the roadmap, gaps, database, architecture, and state docs all point to the same next implementation phase: admin managers for estimates/work orders, materials/units, routes/service areas, subcontract dispatch, and AR/AP + chart-of-accounts.
- Added rationale and reference links showing why a landscaping + project/construction + subcontract + HSE model should keep safety first-class and linkable to jobs, sites, routes, work orders, and dispatches.
- Updated the docs to keep mobile-first field use, desktop-strong admin depth, DB-first shared data, and local SEO/H1 discipline explicit in the next build direction.

## 2026-04-08 admin backbone manager and HSE/OSHA hub pass
- Extended the Admin-side data flow so the new operations/accounting backbone tables can be managed directly from the Admin interface.
- Added an HSE / OSHA Operations Hub surface to keep safety workflows visible and usable while the landscaping/construction backbone grows.
- Updated the SQL 061 migration to an adaptive version that can match legacy `jobs.id` and `sites.id` types when they differ from UUID assumptions.
- Refreshed the roadmap, gaps, database, and architecture docs to reflect the new backbone-first direction and the need to keep HSE standalone-capable.