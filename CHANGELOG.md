## 2026-04-10 receipt rollups, operational status, and posted/open amount pass
- Added migration `064_receipt_rollups_work_order_operational_status_and_posted_amounts.sql`.
- Corrected the schema snapshot so `sql/000_full_schema_reference.sql` truly includes the later workflow passes instead of only claiming it in the header.
- Extended Admin selectors so rollup data from receipt, work-order, HSE, and posting views can be shown directly in the backbone manager.
- Extended Admin manage defaults so line items, receipt lines, AR/AP payments, and linked HSE packets inherit better defaults from the records they are tied to.
- Added clearer mobile/sticky action styling for the backbone manager footer.


> Last synchronized: April 10, 2026. Reviewed during the receipt rollups, work-order operational status, posted/open amount visibility, and admin workflow sync pass.

## 2026-04-09 workflow rollups, posting, receiving-costing, and HSE closeout pass

## 2026-04-09 workflow rollups, posting, receiving-costing, and HSE closeout pass
- Added migration `sql/063_workflow_rollups_posting_and_hse_closeout.sql` for DB-derived totals rollups, invoice/bill payment application, work-order receiving linkage, and HSE packet progress/closeout fields.
- Extended `js/admin-ui.js` so the backbone manager now previews rollups, auto-calculates line totals, suggests payment amounts from balances, and surfaces HSE closeout progress.
- Extended `supabase/functions/admin-manage/index.ts` so linked HSE packet completion and closeout fields can be saved through the Admin manager.
- Refreshed all Markdown docs and the schema snapshot so the repo now points to derived workflow logic instead of manual header maintenance.

- Added DB-first workflow logic so estimate, work-order, and material-receipt header totals can roll up from their line records instead of depending on manual entry.
- Added receivables/payables payment-application logic so invoices and bills can track paid amounts, remaining balance, and partial/paid status from posted payments.
- Added receiving-to-costing linkage so material receipt lines can feed received quantity / received cost visibility back into work-order execution.
- Extended linked HSE packets toward real progress and closeout handling with checklist-style completion fields, derived progress, and clearer Admin-side visibility.


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


Last synchronized: April 10, 2026


## 2026-04-08 landscaping/construction/mobile/admin-ui pathway documentation pass
- Refreshed the Markdown set so the roadmap, gaps, database, architecture, and state docs all point to the same next implementation phase: admin managers for estimates/work orders, materials/units, routes/service areas, subcontract dispatch, and AR/AP + chart-of-accounts.
- Added rationale and reference links showing why a landscaping + project/construction + subcontract + HSE model should keep safety first-class and linkable to jobs, sites, routes, work orders, and dispatches.
- Updated the docs to keep mobile-first field use, desktop-strong admin depth, DB-first shared data, and local SEO/H1 discipline explicit in the next build direction.

## 2026-04-08 admin backbone manager and HSE/OSHA hub pass
- Extended the Admin-side data flow so the new operations/accounting backbone tables can be managed directly from the Admin interface.
- Added an HSE / OSHA Operations Hub surface to keep safety workflows visible and usable while the landscaping/construction backbone grows.
- Updated the SQL 061 migration to an adaptive version that can match legacy `jobs.id` and `sites.id` types when they differ from UUID assumptions.
- Refreshed the roadmap, gaps, database, and architecture docs to reflect the new backbone-first direction and the need to keep HSE standalone-capable.
## 2026-04-10 migration 064 hotfix

- 2026-04-10 hotfix: corrected migration 064 view column order so PostgreSQL can apply it on top of migration 063 without `CREATE OR REPLACE VIEW` rename errors.
