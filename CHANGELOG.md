## 2026-04-08 landscaping/construction/mobile/admin-ui pathway documentation pass
- Refreshed the Markdown set to move the product direction from schema-only groundwork into the next implementation phase: admin UI managers for estimates/work orders, materials/units, routes/service areas, subcontract dispatch, and AR/AP + chart of accounts.
- Added a clearer rationale for keeping HSE as a first-class standalone module that can later link to jobs, sites, and dispatches for landscaping, project, and subcontract work.
- Updated the docs to emphasize mobile-first field use, desktop-strong admin depth, DB-first shared data, and local SEO / one-H1 discipline on every public build pass.

## 2026-04-07 estimates/work-orders/routes/materials/subcontract/GL foundation pass
- Added migration `061_estimates_work_orders_routes_materials_and_gl_foundation.sql` with foundational tables for clients, client sites, service areas, routes, route stops, units of measure, materials catalog, equipment master data, estimates, work orders, subcontract dispatch, chart of accounts, AR, AP, and GL journals.
- Refreshed the schema reference snapshot so the latest schema files reflect the new accounting/operations foundation.
- Rewrote the roadmap, gaps/risk docs, project-state docs, and database docs so the next build phase is clearly focused on the digital admin/operations/accounting backbone.

# Changelog

Last synchronized: April 8, 2026


## 2026-04-08 landscaping/construction/mobile/admin-ui pathway documentation pass
- Refreshed the Markdown set so the roadmap, gaps, database, architecture, and state docs all point to the same next implementation phase: admin managers for estimates/work orders, materials/units, routes/service areas, subcontract dispatch, and AR/AP + chart-of-accounts.
- Added rationale and reference links showing why a landscaping + project/construction + subcontract + HSE model should keep safety first-class and linkable to jobs, sites, routes, work orders, and dispatches.
- Updated the docs to keep mobile-first field use, desktop-strong admin depth, DB-first shared data, and local SEO/H1 discipline explicit in the next build direction.
