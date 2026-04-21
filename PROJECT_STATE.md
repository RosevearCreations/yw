<!-- Reviewed during schema 086 HSE ops performance and site-activity rollup pass on 2026-04-20. -->
<!-- Reviewed during schema 080 recurring agreements / payroll / asset history / login tracking pass on 2026-04-17. -->
## Current pass: 2026-04-17 recurring agreements, asset history, payroll review, and account tracking
- Schema now advances through migration 080.
- The landscaping/service-management model now has recurring service agreements, snow-event thresholds, change orders, customer assets, warranty/callback records, payroll export runs, login-event audit tracking, and stronger job/accounting rollups.
- Admin staff records now expose last-login visibility, and the operations/accounting backbone can manage the new recurring/agreement/asset tables.

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

## 2026-04-11 current state update
- Admin hub navigation is now live for Linked HSE Packets and Analytics / Traffic Monitor.
- HSE review now has packet-level action-item summaries for closeout blockers, reopen follow-up, missing monitoring steps, and missing field signoff.
- Analytics/traffic review now includes daily summary and threshold-alert views on top of raw incidents.
- The project is moving from raw record availability toward review/triage speed for HSE, analytics, and accounting exceptions.

> Last synchronized: April 11, 2026 (admin focus buttons, HSE action-item summaries, and monitor threshold pass)

## 2026-04-11 build state update
- Current pass adds DB-backed HSE packet events, standalone/unscheduled-project packet support, weather/heat/chemical/traffic workflow flags, and field signoff tracking.
- Admin backbone now shows these HSE packet interfaces directly and can fall back to the last good cached data set if the live admin load fails.
- The strongest remaining implementation fronts are upload retry reliability, route/dispatch mobile execution polish, and guided source-journal review flows.

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

### Newly strengthened in this pass
- estimate subtotal / total / cost / margin rollups from estimate lines
- work-order subtotal / total / cost / received-cost rollups from work-order lines and receipt lines
- invoice and bill payment application with amount-paid and balance-due tracking
- linked HSE packet progress, checklist completion, and closeout state

### What is still honestly open after this pass
- full journal batch posting into GL entries
- stronger inventory on-hand movement beyond receipt/cost visibility
- formal route-stop completion workflow and route-day execution state
- deeper field/mobile photo capture around receipts, closeout, and site/HSE packet proof

- Added DB-first workflow logic so estimate, work-order, and material-receipt header totals can roll up from their line records instead of depending on manual entry.
- Added receivables/payables payment-application logic so invoices and bills can track paid amounts, remaining balance, and partial/paid status from posted payments.
- Added receiving-to-costing linkage so material receipt lines can feed received quantity / received cost visibility back into work-order execution.
- Extended linked HSE packets toward real progress and closeout handling with checklist-style completion fields, derived progress, and clearer Admin-side visibility.


## 2026-04-08 landscaping/construction/mobile/admin-ui pathway documentation pass
- Refreshed the Markdown set to move the product direction from schema-only groundwork into the next implementation phase: admin UI managers for estimates/work orders, materials/units, routes/service areas, subcontract dispatch, and AR/AP + chart of accounts.
- Added a clearer rationale for keeping HSE as a first-class standalone module that can later link to jobs, sites, and dispatches for landscaping, project, and subcontract work.
- Updated the docs to emphasize mobile-first field use, desktop-strong admin depth, DB-first shared data, and local SEO / one-H1 discipline on every public build pass.

## 2026-04-07 estimates/work-orders/routes/materials/subcontract/GL foundation pass
- Added schema foundation migration `061_estimates_work_orders_routes_materials_and_gl_foundation.sql` for the next implementation phase.
- Current state is now best described as stable session/auth shell + HSE forms + staff/admin backbone foundations + operations/accounting schema foundation.

# Project State

## April 10, 2026 current state
- The Admin backbone now has stronger visibility into receipt rollups, work-order operational state, and AR/AP posted/open progress.
- The schema reference is now back in sync with the actual migration set through 064.
- The next strong path remains DB-first workflow completion, not another broad shell rewrite.

## April 9, 2026 current state
- Admin now has the backbone needed to manage the new operations/accounting master data.
- The next code/build pass should push from master data into deeper workflow use: lines, stops, payment posting, receiving, and linked HSE packets.
- HSE remains a standalone-capable interface for unscheduled work while also serving as a linked packet model for formal work orders and dispatches.


Last synchronized: April 11, 2026 (admin focus buttons, HSE action-item summaries, and monitor threshold pass)

## Current state

The build now contains a usable blend of:
- stable staff auth/session flows
- HSE field forms
- profile and logbook screens
- staff admin foundations
- dropdown/catalog management foundations
- assignment workbench foundations
- jobs/equipment workflows
- accounting/order scaffolding
- schema foundation for estimates, work orders, materials, routes, subcontract dispatch, and digital accounting

## What is working directionally

### Session-aware internal shell
- standard login/logout shell exists
- protected pages can load under a signed-in session
- role-aware backend direction is established

### HSE forms
- toolbox
- PPE
- first aid
- inspection
- drill
- logbook/review direction exists

### Admin foundations
- staff directory exists
- admin password reset exists
- dropdown/catalog manager exists
- assignment workbench exists
- orders/accounting stub exists

### New schema foundation
- estimates and work orders
- materials catalog and units
- routes and service areas
- subcontract clients and dispatches
- chart of accounts, AR, AP, and GL journals

## What still needs implementation depth
- admin UI for estimates/work orders/materials/routes/subcontract dispatch/accounting
- repeat-save validation and stronger field feedback
- tighter linking between standalone HSE and operations records
- continued DB-first replacement of shared JSON operational data

## Next admin screen layer
- estimate / work-order manager
- materials + units manager
- route / service-area manager
- subcontract dispatch manager
- AR/AP + chart-of-accounts admin screens

These screens should be mobile-friendly for quick field edits and desktop-strong for office/admin work.

## April 8, 2026 current state
- Admin can now begin using the new operations/accounting backbone directly from the Admin screen.
- HSE/OSHA workflows remain the primary standalone field interface and should continue to be listed explicitly as live, partial, or next-stage interfaces in future passes.
- The next completion layer is deeper validation, linked estimate/work-order lines, route stops, payment posting, and more ergonomic mobile editing.

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
- Current state: the jobs screen is now moving from simple record entry toward true crew-owned field execution with supervisor accountability and site activity history.

## 2026-04-10 source-generated journals, route execution, and HSE proof pass
- Added migration `sql/067_source_journal_route_execution_and_hse_proof.sql`.
- Added source-generated draft journal batches for AR invoices, AP bills, material receipts, and material issues so review/posting can start from the originating record instead of manual batch creation.
- Added route-stop execution lifecycle records plus attachment rows so daily field work can track completed, skipped, delayed, and exception states with note/photo support.
- Added HSE proof rows plus reopen-aware linked packet fields so closeout evidence, reopen counts, and follow-up exceptions are visible in the Admin backbone.
- Continued the DB-first move for shared operational/accounting data and refreshed the docs so roadmap, risks, testing, and deployment all point to the same next state.


## Current focus after 070
- HSE packet, event, proof, reopen, and closeout structures are now live in the DB/admin layer.
- Route execution attachments and HSE proofs now have upload functions plus failure-trail fallback.
- Admin can now review traffic analytics and backend monitor incidents directly from the operations/accounting shell.

## 2026-04-11 HSE operations hub and admin section-button pass
- Added a separate **HSE Operations** screen outside the long Admin page so safety workflows, OSHA-oriented reminders, and linked-packet shortcuts can be reached more quickly on desktop and mobile.
- Split the Admin experience into section buttons so people/access, jobs/operations, safety/monitoring, accounting, and messaging/diagnostics can be opened without one long scroll.
- Added migration `sql/072_hse_hub_and_accounting_review_summaries.sql` plus summary views for HSE follow-up and accounting review pressure.
- Corrected Admin selector/view alignment for traffic daily summary and HSE action-item ordering so the newer safety and monitoring shortcuts stay usable.
- Continued the DB-first direction while keeping HSE standalone-capable and easier to connect to jobs, work orders, routes, equipment, dispatches, sites, and subcontract work.

- Admin state: staff create/save flow now has an `admin-manage` compatibility fallback route to reduce silent hangs from direct function stalls.

## April 14, 2026 update
- The `#me` route recovery pass is now part of the active build, with stronger fallback rendering and safer async profile loading.
- The app direction is now explicitly centered on a landscaping operations platform that joins clients, recurring and one-time jobs, crews, equipment reservations, HSE packets, and accounting review.
- Ontario/CAD accounting guardrails are now documented, but the tax engine is still helper-level rather than a full DB-backed tax-code system.


## Current implementation note
The landscaping workflow now supports three linked layers: operations scheduling, equipment/crew planning, and early commercial pricing. Jobs can carry cost, charge, discount, duration, open-end schedule, delay, and repair-cost fields, but estimates/contracts and the fuller Ontario accounting engine are still the next major backend steps.

## Pass status - 2026-04-15 admin pricing/tax backbone
- Migration 077 remains the latest schema step.
- Admin backbone UI now manages `tax_codes`, `business_tax_settings`, and `service_pricing_templates`.
- `admin-manage` was cleaned so only the valid in-handler tax/pricing blocks remain; the duplicated tail after the file closure was removed.



## Current state - landscaping operations backbone
The app is now moving from generic HSE/job management into a more realistic landscaping operations backbone:
- parent jobs for one-time, recurring, and project work
- crew planning and equipment reservation
- per-visit session tracking
- crew-hour logging tied to job execution
- reassignment logging for emergency crew/equipment splits
- pricing/tax/accounting linkage fields ready for later estimate/invoice contract work

## 2026-04-16 state snapshot
- Latest schema target: **083_employee_time_clock_and_break_tracking.sql**.
- The app now treats landscaping/maintenance work as a profitability workflow, not only a scheduling workflow.
- Jobs can now accumulate labor-aware cost review, financial adjustment events, delayed-job pressure, unsigned session pressure, and uninvoiced-completed-job review.
- Staff records now have the start of a labor-rate model so time tracking can feed accounting review.
> Synchronized for the 2026-04-16 accounting-profitability and job-financial-rollup pass.

## Latest pass: schema 081 contract / payroll / snow automation
- New migration: `sql/081_contract_conversion_payroll_exports_and_snow_invoice_automation.sql`.
- Admin now supports estimate-to-agreement conversion, printable contract/application document generation, payroll export file generation, callback/warranty dashboard summaries, and snow-event invoice candidate review.
- Schema reference has been advanced through 081 and the accounting/service-agreement direction now includes document outputs instead of only planning/tracking records.

## 2026-04-19 employee time clock and attendance pass

- Added DB-backed `site_activity_events`, `v_site_activity_recent`, and `v_site_activity_summary` so Admin can review durable activity for staff creation/updates, new jobs, equipment changes, agreements, payroll exports, contracts, and related operational changes.
- Admin now loads and renders a Recent Site Activity table directly from the backend instead of relying only on login traces or per-screen notices.
- `admin-manage`, `jobs-manage`, and `account-maintenance` now record key activity events while still failing safely if the audit trail insert itself has a problem.
- Current schema target is now 082.


## 083 Employee site time clock pass
- Added employee site/job sign-in, unpaid break, resume, and sign-out flow tied to job sessions and payroll-linked crew-hour rows.
- Added admin-visible employee time entry records and recent attendance summary data.
- Added site activity audit coverage for clock in, break start, break end, and clock out.
- Next direction: supervisor approval for employee clock exceptions, geofence/photo proof on arrival, payroll export file generation, and contract/estimate conversion polish.


### 2026-04-19 follow-up
- Added supervisor-review structures for time-clock exceptions.
- Added operational dashboard counts that surface active crews, overdue sign-outs, unsigned sessions, delayed jobs, and loss-making jobs.
- Added agreement execution-candidate rules and backend generate actions for estimate conversion, contract generation, snow invoice generation, and payroll exports.

## 085 state update
Operations, attendance, payroll, and contract flow are now more connected. Employee arrivals can store photos and geofence results, payroll exports are provider-aware, recurring agreements can be processed through scheduler runs, and signed contract documents can generate draft invoices.


## Current build state
- Schema is now advanced through 086 with lighter HSE Ops selector usage and new site-activity rollup views.
- HSE Ops performance has been tightened at both the client and edge-function levels: smaller payload, fewer repeated renders, delegated actions, and cached summary reuse.
- Admin tracing now has stronger summary coverage for new jobs, staff adds, equipment adds, attendance activity, and attention events.
- The main open risks have shifted toward automation depth rather than schema coverage: scheduler timers, signed-contract kickoff, payroll delivery, and richer media review.

## Current build state
