<!-- Reviewed during schema 083 employee time clock / attendance pass on 2026-04-19. -->
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

> Last synchronized: April 11, 2026 (admin focus buttons, HSE action-item summaries, and monitor threshold pass)

## 2026-04-11 architecture note
- HSE now uses a packet + packet-event model instead of relying only on packet headers and proof rows.
- The Admin shell now carries a live-fetch plus last-good-cache fallback path for backbone reads.
- The architecture direction remains: standalone-capable HSE records that can optionally link into jobs, sites, routes, equipment, work orders, and dispatches.

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

## Architecture note added in this pass
The architecture now leans more heavily on **database-derived workflow state**:
- UI helps with data entry and previews
- Supabase Edge Functions broker access and validation
- SQL triggers/functions derive totals, balances, received-cost visibility, and HSE progress/closeout state

That split reduces duplicated logic between the browser and the database and lowers the risk of manual header drift.

- Added DB-first workflow logic so estimate, work-order, and material-receipt header totals can roll up from their line records instead of depending on manual entry.
- Added receivables/payables payment-application logic so invoices and bills can track paid amounts, remaining balance, and partial/paid status from posted payments.
- Added receiving-to-costing linkage so material receipt lines can feed received quantity / received cost visibility back into work-order execution.
- Extended linked HSE packets toward real progress and closeout handling with checklist-style completion fields, derived progress, and clearer Admin-side visibility.


## 2026-04-08 landscaping/construction/mobile/admin-ui pathway documentation pass
- Refreshed the Markdown set to move the product direction from schema-only groundwork into the next implementation phase: admin UI managers for estimates/work orders, materials/units, routes/service areas, subcontract dispatch, and AR/AP + chart of accounts.
- Added a clearer rationale for keeping HSE as a first-class standalone module that can later link to jobs, sites, and dispatches for landscaping, project, and subcontract work.
- Updated the docs to emphasize mobile-first field use, desktop-strong admin depth, DB-first shared data, and local SEO / one-H1 discipline on every public build pass.

> Last synchronized: April 8, 2026. Reviewed during the estimates/work-orders/routes/materials/subcontract/general-ledger foundation and documentation synchronization pass.

# System Architecture

## April 10, 2026 architecture note
- The admin-selectors edge function now merges DB rollup views back into the backbone manager payload so operational rollups stay DB-first but UI-visible.
- The admin-manage edge function now fills more defaults from linked records to reduce mobile/manual entry friction.

## April 9, 2026 architecture note
- Continue converging toward DB-first operational data for shared selectors, materials, equipment, estimates, work orders, dispatches, and accounting.
- Treat the HSE packet linkage as a join point between the standalone safety workflows and the formal operations/accounting backbone.


Last synchronized: April 11, 2026 (admin focus buttons, HSE action-item summaries, and monitor threshold pass)

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

## 2026-04-10 crew assignment, recurring jobs, and field activity pass
- Job creation now has a clearer ownership path: a crew can be assigned at the same time as an explicit supervisor so responsibility is visible from the start.
- Jobs now support standalone or recurring scheduling fields, with recurrence summary/rule storage in the database instead of leaving schedule logic only in draft UI state.
- Job comments now have a DB-backed activity trail with optional photo attachments and special-instruction flags so crews and supervisors can review site notes, uploaded images, and field changes in one place.
- This pass continues the DB-first direction for shared operational data and reduces duplication risk compared with keeping crew/job packet details only in local JSON or loosely coupled browser state.
- Architecture effect: jobs are now a stronger coordination hub joining crews, supervisors, schedules, comments, and field media instead of treating those items as separate ad hoc notes.

## 2026-04-10 source-generated journals, route execution, and HSE proof pass
- Added migration `sql/067_source_journal_route_execution_and_hse_proof.sql`.
- Added source-generated draft journal batches for AR invoices, AP bills, material receipts, and material issues so review/posting can start from the originating record instead of manual batch creation.
- Added route-stop execution lifecycle records plus attachment rows so daily field work can track completed, skipped, delayed, and exception states with note/photo support.
- Added HSE proof rows plus reopen-aware linked packet fields so closeout evidence, reopen counts, and follow-up exceptions are visible in the Admin backbone.
- Continued the DB-first move for shared operational/accounting data and refreshed the docs so roadmap, risks, testing, and deployment all point to the same next state.

## 2026-04-11 HSE operations hub and admin section-button pass
- Added a separate **HSE Operations** screen outside the long Admin page so safety workflows, OSHA-oriented reminders, and linked-packet shortcuts can be reached more quickly on desktop and mobile.
- Split the Admin experience into section buttons so people/access, jobs/operations, safety/monitoring, accounting, and messaging/diagnostics can be opened without one long scroll.
- Added migration `sql/072_hse_hub_and_accounting_review_summaries.sql` plus summary views for HSE follow-up and accounting review pressure.
- Corrected Admin selector/view alignment for traffic daily summary and HSE action-item ordering so the newer safety and monitoring shortcuts stay usable.
- Continued the DB-first direction while keeping HSE standalone-capable and easier to connect to jobs, work orders, routes, equipment, dispatches, sites, and subcontract work.

## 2026-04-14 landscaping operations modeling pass
- The operations architecture now more clearly separates three real scheduling patterns: one-time field jobs, repeating service jobs, and larger custom project work.
- Crew planning now sits between jobs and equipment more explicitly: a saved crew can carry its own kind, lead, supervisor, service-area context, and default equipment notes before it is attached to a job.
- Equipment planning now uses reservation windows as a first-class scheduling signal, which is a better fit for weekly mowing, snow, foliage, and other repeating field services than relying only on a single start/end date pair.


## Current architecture direction
The landscaping stack is now explicitly blending operations and commercial logic. Jobs sit between client/service intake and downstream accounting, and are being prepared to bridge into estimates, contracts, recurring service pricing, and Ontario-compliant posting flows.
> Synchronized for the 2026-04-16 accounting-profitability and job-financial-rollup pass.


## 2026-04-19 employee time clock and attendance pass

- Added DB-backed `site_activity_events`, `v_site_activity_recent`, and `v_site_activity_summary` so Admin can review durable activity for staff creation/updates, new jobs, equipment changes, agreements, payroll exports, contracts, and related operational changes.
- Admin now loads and renders a Recent Site Activity table directly from the backend instead of relying only on login traces or per-screen notices.
- `admin-manage`, `jobs-manage`, and `account-maintenance` now record key activity events while still failing safely if the audit trail insert itself has a problem.
- Current schema target is now 082.
