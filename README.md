<!-- Reviewed during schema 082 site activity audit / admin recent-activity pass on 2026-04-18. -->
<!-- Reviewed during schema 080 recurring agreements / payroll / asset history / login tracking pass on 2026-04-17. -->
## 2026-04-13 staff admin save verification pass
- Added visible inline create/save/reset/block/delete confirmations in the Staff Directory screen so staff actions no longer fail silently from the operator’s point of view.
- Added stronger front-end email and password validation plus busy-state feedback for staff actions.
- Updated `supabase/functions/admin-manage/index.ts` so staff-detail saves now persist email changes instead of leaving the visible Email field unsaved.
- No new SQL migration was added in this pass; schema files were reviewed and remain on the 074 baseline.

> Last synchronized: April 14, 2026 (landscaping job workflow, crew planning, and schema 075)

## 2026-04-12 HSE control cues and inspection focus pass
- Added migration `sql/074_hse_control_cues_and_inspection_focus.sql`.
- HSE packets and packet events now expose structured machinery/tool, lifting/posture, weather/heat, and chemical/public-interaction fields so follow-up can be filtered instead of buried in free text.
- HSE Ops summary cards now keep machinery/lifting and chemical/public/cones pressure visible alongside the existing monitor shortcuts.
- Site Inspection now has category-focused hazard presets so inspections can capture the four requested field-risk themes more consistently on phone or desktop.

> Last synchronized: April 12, 2026 (HSE control cues, inspection focus, and schema 074)

> Last synchronized: April 12, 2026 (linked HSE review lanes, monitor shortcuts, admin drill-through, and schema 073)

## Latest pass
- Fixed the inactive Admin hub buttons for **Linked HSE Packets** and **Analytics / Traffic Monitor**.
- Added HSE action-item summaries, traffic daily summaries, and monitoring threshold alerts so Admin can review safety and reliability pressure without starting from raw rows.
- Continued the DB-first HSE/accounting direction by surfacing journal-sync pressure alongside HSE follow-up and monitor incidents.

> Last synchronized: April 11, 2026 (admin focus buttons, HSE action-item summaries, and monitor threshold pass)

## Current focus
- The strongest current direction is still DB-first operations + HSE, but the latest pass specifically deepens the OSHA-facing HSE interfaces: standalone packets, unscheduled-project packets, packet events, weather/heat/chemical/traffic workflow tracking, and field signoff.
- Admin now has a stronger fallback path because the last good directory/backbone load is cached locally and can be shown when the live admin fetch fails.

## 2026-04-11 journal sync exceptions and upload fallback pass
- Added migration `sql/068_journal_sync_exceptions_and_upload_failure_fallback.sql`.
- Added DB-backed `gl_journal_sync_exceptions` so stale, unbalanced, and missing-entry source batches are visible as first-class review items instead of hidden batch-state guesses.
- Added DB-backed `field_upload_failures` so failed job-comment and equipment-evidence uploads leave an auditable fallback trail for retry/resolution instead of failing silently.
- Extended Admin selectors/directory/manage/UI so sync exceptions and upload failures can be reviewed, resolved, or dismissed from the same backbone shell.
- Tightened job activity upload handling so comments can still save even when attachments fail, with clearer operator feedback and follow-up visibility.


## 2026-04-10 journal posting controls and material issue / usage pass
- Added migration `sql/066_journal_posting_controls_and_material_issue_usage.sql`.
- Added DB-side journal-batch rollups so line count, debit total, credit total, and balanced state are derived instead of tracked manually.
- Added DB-backed `material_issues` and `material_issue_lines` so receiving can progress into job usage, issued-cost totals, and variance visibility.
- Extended the Admin backbone so journal batches, journal entries, material issues, and material issue lines can be created and managed from the same operational shell.
- Continued the DB-first direction for shared operational data while keeping the next highest-value gaps visible: route execution lifecycle, HSE proof/reopen, and stronger source-to-journal automation.

## 2026-04-09 workflow rollups, posting, receiving-costing, and HSE closeout pass

### Current direction after this pass
- The Admin backbone is no longer just a placeholder master-data shell. It now has matching DB logic for derived totals, payment application, receiving-linked costing, and HSE packet progress/closeout.
- Shared operational truth should continue moving into the database whenever the same totals or statuses would otherwise be entered in multiple places.
- Public-page SEO remains a maintenance rule each pass: one H1 per exposed page, descriptive titles/meta, useful headings, crawlable app shell assets, and continued local-intent wording where public marketing pages exist.

- Added DB-first workflow logic so estimate, work-order, and material-receipt header totals can roll up from their line records instead of depending on manual entry.
- Added receivables/payables payment-application logic so invoices and bills can track paid amounts, remaining balance, and partial/paid status from posted payments.
- Added receiving-to-costing linkage so material receipt lines can feed received quantity / received cost visibility back into work-order execution.
- Extended linked HSE packets toward real progress and closeout handling with checklist-style completion fields, derived progress, and clearer Admin-side visibility.


## 2026-04-08 landscaping/construction/mobile/admin-ui pathway documentation pass
- Refreshed the Markdown set to move the product direction from schema-only groundwork into the next implementation phase: admin UI managers for estimates/work orders, materials/units, routes/service areas, subcontract dispatch, and AR/AP + chart of accounts.
- Added a clearer rationale for keeping HSE as a first-class standalone module that can later link to jobs, sites, and dispatches for landscaping, project, and subcontract work.
- Updated the docs to emphasize mobile-first field use, desktop-strong admin depth, DB-first shared data, and local SEO / one-H1 discipline on every public build pass.

## 2026-04-07 estimates/work-orders/routes/materials/subcontract/GL foundation pass
- Added schema foundation migration `061_estimates_work_orders_routes_materials_and_gl_foundation.sql` for clients, client sites, service areas, routes, route stops, materials catalog, units of measure, equipment master data, estimates, work orders, subcontract dispatch, chart of accounts, AR, AP, and general-ledger journals.
- Refreshed the schema reference snapshot so the repo now documents a digital operations + accounting direction instead of leaving that work only in roadmap notes.
- Updated the Markdown set to treat the current auth/session stabilization as substantially complete and move the main forward direction into admin backbone depth, landscaping/project/subcontract workflows, and fully digital receivables/payables/accounting.

# YW Operations + HSE Platform

## April 10, 2026 receipt and operational rollup direction
- The next pass now moves beyond balance-only visibility and adds stronger operational visibility for receipts, work orders, and posted/open amounts.
- Admin should show database-derived rollups wherever possible so supervisors and office staff are not relying on manual mental math.
- Receipt allocation remains a staged process: received cost can exist before every line is assigned to a work-order line, so unallocated cost must remain visible.

## April 9, 2026 deeper workflow polish direction
- The next strongest implementation pass is now deeper workflow polish on top of the new Admin backbone manager.
- Priority UI managers: estimate/work-order lines, route stops, AR/AP payment posting, material receiving, and linked HSE packets for work orders and dispatches.
- The HSE side must remain standalone-capable for unscheduled work while also linking cleanly into routes, work orders, dispatches, sites, equipment, and client records whenever a formal job exists.
- The most efficient data direction continues to be DB-first for shared dropdowns, equipment, materials, job costing, AR/AP, and GL scaffolding, with JSON retained only where a bundled fallback is still operationally useful.

### Why this direction makes sense
- OSHA landscaping guidance emphasizes recurring hazards around machinery/tools, lifting, slips/trips/falls, vehicles, chemicals, and heat stress, which supports keeping the HSE side first-class and linkable to jobs, sites, routes, equipment, and dispatches.
- Project-based landscaping/construction operations depend on job costing, progress invoicing, purchase/material receiving, and inventory tracking, which aligns with estimates, work orders, AR/AP, and a general ledger backbone.
- IRS small-business and depreciation guidance supports keeping materials, equipment, expenses, receivables, payables, and asset records digital and structured so operational and tax records do not drift apart.


Last synchronized: April 11, 2026 (admin focus buttons, HSE action-item summaries, and monitor threshold pass)

## What this project is

This repository is the working build of a role-aware operations platform for a landscaping and field-services company with a connected HSE safety application.

The platform now has four connected business modes:

1. **Landscaping and grounds maintenance**
   - recurring property maintenance
   - seasonal cleanup
   - planting, mulching, pruning, edging, irrigation checks
   - route-based crew scheduling

2. **Project and construction-style work**
   - splash pads
   - children's parks
   - site upgrades and small civil/building support
   - estimate-to-work-order delivery

3. **Subcontract / operator-and-equipment dispatch**
   - backhoe + operator or similar machine dispatch to another firm
   - client-specific site, billing, and safety requirements
   - time, cost, and invoicing by dispatch

4. **Standalone HSE / safety operations**
   - toolbox, inspection, first-aid, PPE, drill, and logbook workflows
   - can run without a full operations job when the project is unscheduled or ad hoc
   - can later be linked to jobs/sites/clients/work orders

## Core product direction

The product direction is now:
- mobile-first for field workers
- desktop-strong for office/admin users
- role-aware for Admin, Supervisor, and Employee users
- database-first for shared dropdowns, staff lists, equipment, jobs, work orders, materials, routes, and accounting structures
- validation-first so saves are repeatable and one user's identity never cross-contaminates another user's view

## Why this direction makes sense

This direction fits the real work mix the company performs:
- recurring landscaping and grounds maintenance
- project / construction-style jobs such as splash pads and children's parks
- subcontract operator-and-equipment dispatch to other firms
- standalone HSE workflows for unscheduled or ad hoc work

It also fits the external guidance that most strongly affects the business model:
- **OSHA landscaping guidance** emphasizes machinery, heat and cold stress, lifting/awkward postures, pesticides/chemicals, and both maintenance and construction activity, which supports keeping HSE linkable to jobs, sites, routes, and dispatches.
- **IRS small-business and depreciation guidance** supports keeping materials, equipment, expenses, and accounting records structured and digital so ordinary business expenses, inventory/material treatment, and depreciable equipment are easier to track.
- For project-based landscaping/construction work, the practical next layer is estimates, work orders, materials, AR/AP, and general-ledger structure so costing, billing, and profitability can be managed in one system.

Reference links for future planning:
- OSHA landscaping hazards: https://www.osha.gov/landscaping/hazards
- OSHA landscaping overview/standards: https://www.osha.gov/landscaping
- IRS Publication 334, Tax Guide for Small Business: https://www.irs.gov/publications/p334
- IRS Publication 946, How To Depreciate Property: https://www.irs.gov/publications/p946
- IRS Tangible Property Regulations FAQ: https://www.irs.gov/businesses/small-businesses-self-employed/tangible-property-final-regulations

## Next strongest build pass

The next strongest build pass after the current schema-and-docs phase is to make the Admin UI actually use the new tables:
- estimate / work-order manager
- materials + units manager
- route / service-area manager
- subcontract dispatch manager
- AR/AP + chart-of-accounts admin screens

## Admin backbone goals

The admin backbone is intended to become the single source of truth for:
- staff directory and hierarchy
- permissions and role assignment
- equipment catalog and master data
- shared dropdown/reference values
- clients and sites
- estimates and work orders
- routes and crew assignments
- materials usage and costing
- receivables and payables
- general-ledger setup and digital accounting controls
- safety templates and required forms

## Current major modules

### 1) Auth and staff identity
- session-based login/logout
- onboarding completion
- profile and staff metadata
- password reset and admin password control
- staff roles: Admin / Supervisor / Employee

### 2) HSE / field safety
- toolbox talks
- PPE checks
- first aid kit checks
- site inspections
- emergency drills
- logbook and review flows

### 3) Operations and admin
- staff directory
- dropdown/catalog manager
- assignment workbench
- jobs/equipment workflows
- accounting/order scaffolding

### 4) New schema foundation now in repo
- estimates
- work orders
- materials catalog + units
- routes + service areas
- subcontract clients + dispatches
- equipment master data
- chart of accounts
- AR invoices/payments
- AP vendors/bills/payments
- journal batches and entries

## Current priority

The app is now stable enough that the main build priority shifts from shell repair toward **deepening the operations and accounting backbone** while keeping the HSE side standalone-capable.

## April 8, 2026 direction update
- The platform direction is now a landscaping / construction / subcontract operations system with a standalone-capable HSE safety core.
- The Admin backbone is expected to be the source of truth for dropdowns, equipment listings, employee listings, job/work-order records, materials, routes, dispatches, and accounting masters.
- The next implementation step after this pass is to use the new operations/accounting tables directly from the Admin UI end to end.
- The HSE side remains usable on unscheduled work even when no formal estimate/work-order exists.

### OSHA / HSE outstanding interfaces to keep visible
- linked HSE packet manager for work orders and subcontract dispatches
- heat / weather exposure workflow for landscaping and project crews
- chemical handling / SDS / pesticide-use linkage where applicable
- traffic / public-interaction controls for parks, roadsides, and municipal work
- equipment-specific JSA / inspection linkage
- field signoff and closeout flow that can work both standalone and attached to a formal job

### Mobile-friendly direction to keep pushing
- large tap targets for supervisors and crew leads in the field
- condensed line-entry forms with sticky save actions
- camera-first attachments and scan-to-link for receipts / equipment / HSE packets
- offline-safe draft saving for route stops, line items, and site safety checks
- simplified worker-facing packet progress views that avoid desktop-only layouts

- 2026-04-10 hotfix: corrected migration 064 view column order so PostgreSQL can apply it on top of migration 063 without `CREATE OR REPLACE VIEW` rename errors.

## 2026-04-10 crew assignment, recurring jobs, and field activity pass
- Job creation now has a clearer ownership path: a crew can be assigned at the same time as an explicit supervisor so responsibility is visible from the start.
- Jobs now support standalone or recurring scheduling fields, with recurrence summary/rule storage in the database instead of leaving schedule logic only in draft UI state.
- Job comments now have a DB-backed activity trail with optional photo attachments and special-instruction flags so crews and supervisors can review site notes, uploaded images, and field changes in one place.
- This pass continues the DB-first direction for shared operational data and reduces duplication risk compared with keeping crew/job packet details only in local JSON or loosely coupled browser state.
- Operator note: run migration 065 before expecting crew assignment, recurring fields, or job activity/photo records to appear correctly in live jobs flows.

## 2026-04-10 source-generated journals, route execution, and HSE proof pass
- Added migration `sql/067_source_journal_route_execution_and_hse_proof.sql`.
- Added source-generated draft journal batches for AR invoices, AP bills, material receipts, and material issues so review/posting can start from the originating record instead of manual batch creation.
- Added route-stop execution lifecycle records plus attachment rows so daily field work can track completed, skipped, delayed, and exception states with note/photo support.
- Added HSE proof rows plus reopen-aware linked packet fields so closeout evidence, reopen counts, and follow-up exceptions are visible in the Admin backbone.
- Continued the DB-first move for shared operational/accounting data and refreshed the docs so roadmap, risks, testing, and deployment all point to the same next state.


## Latest implementation pass
The latest pass adds the remaining HSE proof/upload reliability layer plus a DB-backed analytics and backend monitoring system. Admin can now review traffic events, API/runtime incidents, upload failures, HSE packets/events/proofs, and the broader operations/accounting backbone from one interface.

## 2026-04-11 HSE operations hub and admin section-button pass
- Added a separate **HSE Operations** screen outside the long Admin page so safety workflows, OSHA-oriented reminders, and linked-packet shortcuts can be reached more quickly on desktop and mobile.
- Split the Admin experience into section buttons so people/access, jobs/operations, safety/monitoring, accounting, and messaging/diagnostics can be opened without one long scroll.
- Added migration `sql/072_hse_hub_and_accounting_review_summaries.sql` plus summary views for HSE follow-up and accounting review pressure.
- Corrected Admin selector/view alignment for traffic daily summary and HSE action-item ordering so the newer safety and monitoring shortcuts stay usable.
- Continued the DB-first direction while keeping HSE standalone-capable and easier to connect to jobs, work orders, routes, equipment, dispatches, sites, and subcontract work.

- Admin reliability note: the staff create/save workflow now supports a same-origin `api/auth/admin-manage.js` compatibility proxy when the direct Supabase Edge Function path is unavailable or stalled.

## Current implementation direction
The application is now being shaped as a Southern Ontario landscaping and field-operations platform that links clients, sites, one-time jobs, recurring service work, crews, equipment planning, HSE packets, and accounting records.

Ontario/CAD accounting guardrails are now documented in `docs/ONTARIO_ACCOUNTING_AND_TAX_GUARDRAILS.md`. The current build includes helper-level Ontario HST handling in the Admin order/accounting stub, but the full DB-backed tax settings and tax-code engine are still a follow-on step.


### Current emphasis
The current build emphasizes landscaping job operations plus early commercial logic: crew planning, equipment reservation, job pricing, discount handling, duration planning, delayed work tracking, and profit/loss hooks.

## Latest operations/accounting build note
The app now includes DB-backed Ontario-oriented tax code records, business tax settings, and reusable service pricing templates, with Admin backbone screens to manage them.



## Latest operations pass
This build now supports sortable jobs review plus session/hours/reassignment tracking for landscaping operations. Recurring work like mowing and snow can be priced at the parent job level while still recording each field visit separately.

## Current focus
This build now includes labor-aware job profitability review and DB-backed job financial adjustment events, so the project is moving from scheduling/operations into a fuller landscaping-service accounting backbone.
> Synchronized for the 2026-04-16 accounting-profitability and job-financial-rollup pass.

## Schema 081 latest operations/accounting step
- Estimate to agreement conversion
- Printable contract / application document generation
- Payroll export CSV generation
- Callback / warranty dashboard summary
- Agreement profitability and snow-event invoice candidate review

## 2026-04-18 site activity audit and admin visibility pass

- Added DB-backed `site_activity_events`, `v_site_activity_recent`, and `v_site_activity_summary` so Admin can review durable activity for staff creation/updates, new jobs, equipment changes, agreements, payroll exports, contracts, and related operational changes.
- Admin now loads and renders a Recent Site Activity table directly from the backend instead of relying only on login traces or per-screen notices.
- `admin-manage`, `jobs-manage`, and `account-maintenance` now record key activity events while still failing safely if the audit trail insert itself has a problem.
- Current schema target is now 082.
