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

## April 11, 2026 quick handoff
- Current pass fixed the inactive Admin hub buttons for Linked HSE Packets and Analytics / Traffic Monitor.
- New review views now surface HSE action items, traffic daily summaries, and threshold-style monitoring alerts.
- Next strongest work remains mobile closeout speed, alert drill-through, and deeper accounting exception review.

> Last synchronized: April 11, 2026 (admin focus buttons, HSE action-item summaries, and monitor threshold pass)

## 2026-04-11 project-brain refresh
- The HSE side is now moving from packet headers plus proofs into a fuller packet-event workflow.
- Standalone safety work remains first-class, but packets can now link more naturally to jobs, sites, work orders, routes, equipment, and dispatches.
- The next highest-value work is mobile/live validation, upload retry depth, and tighter operational/accounting review tooling.

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
- Added DB-first workflow logic so estimate, work-order, and material-receipt header totals can roll up from their line records instead of depending on manual entry.
- Added receivables/payables payment-application logic so invoices and bills can track paid amounts, remaining balance, and partial/paid status from posted payments.
- Added receiving-to-costing linkage so material receipt lines can feed received quantity / received cost visibility back into work-order execution.
- Extended linked HSE packets toward real progress and closeout handling with checklist-style completion fields, derived progress, and clearer Admin-side visibility.


## 2026-04-08 landscaping/construction/mobile/admin-ui pathway documentation pass
- Refreshed the Markdown set to move the product direction from schema-only groundwork into the next implementation phase: admin UI managers for estimates/work orders, materials/units, routes/service areas, subcontract dispatch, and AR/AP + chart of accounts.
- Added a clearer rationale for keeping HSE as a first-class standalone module that can later link to jobs, sites, and dispatches for landscaping, project, and subcontract work.
- Updated the docs to emphasize mobile-first field use, desktop-strong admin depth, DB-first shared data, and local SEO / one-H1 discipline on every public build pass.

# Project Brain

## April 10, 2026 project-brain refresh
- Current strongest direction: keep moving from schema presence into DB-driven operational visibility and safer admin defaults.
- The next build should focus on true posting controls, material issue/usage, route execution, and richer HSE proof/closeout.

## April 9, 2026 project-brain refresh
- The company direction is landscaping-led but must support project/construction work, municipal/public jobs, and subcontract dispatches.
- Admin is the source of truth for shared dropdowns, staff, equipment, routes, clients, sites, materials, estimates, work orders, dispatches, AR/AP, and chart-of-accounts structures.
- HSE is not a side module; it is a parallel first-class workflow that must work standalone and linked.


Last synchronized: April 11, 2026 (admin focus buttons, HSE action-item summaries, and monitor threshold pass)

## Product summary

This project is a **field operations platform with an integrated HSE safety application** for a landscaping-led company that also performs project work, construction-style work, and subcontract machine/operator dispatch.

## Business reality the app must support

### A) Recurring landscaping operations
- mowing and trimming routes
- spring and fall cleanup
- bed maintenance
- pruning and planting
- property visits with repeating schedules

### B) One-off project work
- splash pads
- children's park work
- local construction support
- hardscape/site enhancement jobs
- small building or site-related jobs

### C) Subcontract dispatch work
- backhoe + operator for a fibre optic contractor
- employee sent to another firm for a day or project
- client-specific site, safety, and billing requirements

### D) Standalone HSE usage
- unscheduled project where only the safety module is needed
- project-specific inspection or toolbox flow without a formal work order
- ad hoc site documentation when operations-side records are not yet created

## Identity and role model
- **Admin**: full access to staff, jobs, equipment, dropdowns, approvals, work orders, accounting, and configuration
- **Supervisor**: oversight of assigned crews, jobs, routes, equipment, and field workflows within scope
- **Employee**: assigned work, field forms, job updates, limited self-profile access

## Data backbone that should be database-first
- staff directory
- positions/trades
- staff tiers and seniority
- employment statuses
- equipment classes and equipment items
- job types and work order statuses
- material catalog and units
- route/service area references
- recurring task templates
- HSE form templates and safety categories
- chart of accounts and standard cost mappings

## Core linked modules
- Staff
- Equipment
- Estimates
- Work orders
- Routes and visits
- Subcontract dispatch
- HSE
- Receivables / Payables / General ledger

## Next admin screen layer
- estimate / work-order manager
- materials + units manager
- route / service-area manager
- subcontract dispatch manager
- AR/AP + chart-of-accounts admin screens

These screens should be mobile-friendly for quick field edits and desktop-strong for office/admin work.

## April 8, 2026 project brain update
Treat the product as a landscaping / project-work / subcontract dispatch platform with a first-class HSE app inside it. The HSE side must always be able to run on its own for unscheduled work, but Admin should still be able to connect safety records back to routes, sites, work orders, dispatches, equipment, and accounting later.

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

## 2026-04-10 crew assignment, recurring jobs, and field activity pass
- Job creation now has a clearer ownership path: a crew can be assigned at the same time as an explicit supervisor so responsibility is visible from the start.
- Jobs now support standalone or recurring scheduling fields, with recurrence summary/rule storage in the database instead of leaving schedule logic only in draft UI state.
- Job comments now have a DB-backed activity trail with optional photo attachments and special-instruction flags so crews and supervisors can review site notes, uploaded images, and field changes in one place.
- This pass continues the DB-first direction for shared operational data and reduces duplication risk compared with keeping crew/job packet details only in local JSON or loosely coupled browser state.
- Remember for future chats: the next job-system polish should build on crew ownership, recurrence storage, and attachment-aware site comments instead of reintroducing JSON-only scheduling notes.

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

- Recent fix: `Create Staff User` now retries through `/api/auth/admin-manage` when the direct Supabase `admin-manage` function path stalls or returns HTML.

## Latest build memory
- `#me` route was hardened in the frontend with fallback rendering and correct async load counters.
- Jobs direction is now explicitly landscaping-first: one-time installs, recurring service, and large custom project work all converge on crews, equipment, and later accounting.
- Ontario/CAD accounting guidance now has a dedicated Markdown note; next steps should move those defaults into DB-backed tax settings.


### Latest brain update
Jobs are no longer only operational. They now carry pricing, discount, margin, open-end schedule, delay, and repair-loss hooks. Treat estimates/contracts and Ontario accounting automation as the next layer on top of this job backbone.



## Current emphasis
Treat jobs as the operational parent record, but treat recurring visits, actual labor, and emergency resource changes as separate tracked records:
- `jobs` = commercial/planning shell
- `job_sessions` = each real field visit or execution window
- `job_session_crew_hours` = labor detail for invoicing/accounting
- `job_reassignment_events` = crew/equipment split history

## Current quick-start emphasis
- Think in terms of **service-business accounting flow**:
  estimate/template -> job/work order -> session/crew hours -> financial events -> invoice/accounting review.
- For this repo, the most important near-term objective is tightening the Ontario landscaping accounting and invoicing backbone without losing recurring-service speed.
> Synchronized for the 2026-04-16 accounting-profitability and job-financial-rollup pass.

