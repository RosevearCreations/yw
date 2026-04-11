> Last synchronized: April 11, 2026 (HSE upload retry, safety screens, and analytics/traffic monitoring pass)

## 2026-04-11
- Added migration `sql/070_hse_upload_retry_and_analytics_monitoring.sql`.
- Added Supabase Edge Functions:
  - `analytics-traffic`
  - `upload-route-execution-attachment`
  - `upload-hse-packet-proof`
- Extended Admin to manage traffic events, backend monitor incidents, and richer upload-failure retry records.
- Added route/HSE upload replacement flow in the Admin backbone manager.

## 2026-04-11 HSE OSHA interface, packet events, and field signoff pass
- Added `sql/069_hse_osha_interfaces_weather_chemical_traffic_signoff.sql`.
- Extended `linked_hse_packets` with standalone-project, packet-scope, job/equipment linkage, monitoring flags, and field signoff tracking.
- Added `hse_packet_events` plus packet-progress/event rollups for weather, heat, chemical, traffic, signoff, closeout, and reopen flows.
- Updated Admin selectors/directory/manage/UI to expose the new HSE packet interfaces and cached fallback behavior.

## 2026-04-11 journal sync exceptions and upload fallback pass
- Added migration `sql/068_journal_sync_exceptions_and_upload_failure_fallback.sql`.
- Added DB-backed `gl_journal_sync_exceptions` so stale, unbalanced, and missing-entry source batches are visible as first-class review items instead of hidden batch-state guesses.
- Added DB-backed `field_upload_failures` so failed job-comment and equipment-evidence uploads leave an auditable fallback trail for retry/resolution instead of failing silently.
- Extended Admin selectors/directory/manage/UI so sync exceptions and upload failures can be reviewed, resolved, or dismissed from the same backbone shell.
- Tightened job activity upload handling so comments can still save even when attachments fail, with clearer operator feedback and follow-up visibility.

## 2026-04-10 journal posting controls and material issue / usage pass
- Added migration `sql/066_journal_posting_controls_and_material_issue_usage.sql`.
- Added Admin backbone support for Journal Batches, Journal Entries, Material Issues, and Material Issue Lines.
- Added SQL rollups for balanced journal posting state and issue-to-estimate variance visibility.
- Updated `sql/000_full_schema_reference.sql`, `supabase/functions/admin-directory/index.ts`, `supabase/functions/admin-selectors/index.ts`, `supabase/functions/admin-manage/index.ts`, `js/admin-ui.js`, `index.html`, `server-worker.js`, and the Markdown set.

## 2026-04-10 receipt rollups, operational status, and posted/open amount pass
- Added migration `064_receipt_rollups_work_order_operational_status_and_posted_amounts.sql`.
- Corrected the schema snapshot so `sql/000_full_schema_reference.sql` truly includes the later workflow passes instead of only claiming it in the header.
- Extended Admin selectors so rollup data from receipt, work-order, HSE, and posting views can be shown directly in the backbone manager.
- Extended Admin manage defaults so line items, receipt lines, AR/AP payments, and linked HSE packets inherit better defaults from the records they are tied to.
- Added clearer mobile/sticky action styling for the backbone manager footer.


> Last synchronized: April 11, 2026 (journal sync exceptions / upload fallback pass)

## 2026-04-10 journal posting controls and material issue / usage pass
- Added migration `sql/066_journal_posting_controls_and_material_issue_usage.sql`.
- Added DB-side journal-batch rollups so line count, debit total, credit total, and balanced state are derived instead of tracked manually.
- Added DB-backed `material_issues` and `material_issue_lines` so receiving can progress into job usage, issued-cost totals, and variance visibility.
- Extended the Admin backbone so journal batches, journal entries, material issues, and material issue lines can be created and managed from the same operational shell.
- Continued the DB-first direction for shared operational data while keeping the next highest-value gaps visible: route execution lifecycle, HSE proof/reopen, and stronger source-to-journal automation.

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


Last synchronized: April 11, 2026 (journal sync exceptions / upload fallback pass)


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

## 2026-04-10 crew assignment, recurring jobs, and field activity pass
- Job creation now has a clearer ownership path: a crew can be assigned at the same time as an explicit supervisor so responsibility is visible from the start.
- Jobs now support standalone or recurring scheduling fields, with recurrence summary/rule storage in the database instead of leaving schedule logic only in draft UI state.
- Job comments now have a DB-backed activity trail with optional photo attachments and special-instruction flags so crews and supervisors can review site notes, uploaded images, and field changes in one place.
- This pass continues the DB-first direction for shared operational data and reduces duplication risk compared with keeping crew/job packet details only in local JSON or loosely coupled browser state.
- 2026-04-10 pass: added migration 065 for crews, supervisor-linked job ownership, recurring scheduling, and job activity/photo tracking.

## 2026-04-10 source-generated journals, route execution, and HSE proof pass
- Added migration `sql/067_source_journal_route_execution_and_hse_proof.sql`.
- Added source-generated draft journal batches for AR invoices, AP bills, material receipts, and material issues so review/posting can start from the originating record instead of manual batch creation.
- Added route-stop execution lifecycle records plus attachment rows so daily field work can track completed, skipped, delayed, and exception states with note/photo support.
- Added HSE proof rows plus reopen-aware linked packet fields so closeout evidence, reopen counts, and follow-up exceptions are visible in the Admin backbone.
- Continued the DB-first move for shared operational/accounting data and refreshed the docs so roadmap, risks, testing, and deployment all point to the same next state.
