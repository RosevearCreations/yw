## 2026-04-12 linked HSE review lanes and monitor shortcut pass
- Added migration `sql/073_hse_link_context_and_monitor_shortcuts.sql`.
- Added DB-backed `v_hse_link_context_summary` so the standalone HSE hub can open linked packet review by jobs/work orders, sites, routes/dispatches/subcontract work, equipment, and standalone/unscheduled packets.
- Added DB-backed `v_monitor_review_summary` so HSE Ops can expose upload issues, traffic/reliability pressure, and runtime/API incidents as focused review lanes instead of only broad monitor buttons.
- Extended HSE Ops so shortcut cards can pass an exact Admin focus target, selected record, and summary while keeping the cached fallback path intact.
- Tightened the HSE shell around the requested direction: standalone-capable packets remain valid, but formal job, route, dispatch, site, equipment, and monitor context now opens more directly.

## Immediate next build priorities after 073
1. **Linked packet create flows from adjacent shells**
   - let Jobs, Equipment, and Dispatch screens create or open the correct linked HSE packet without forcing Admin first
   - carry crew, supervisor, and site defaults into the packet when a formal record already exists
2. **Monitor action handling**
   - add resolve / snooze / assign actions for noisy monitor lanes and repeated upload failures
   - allow the shortcut cards to land on pre-filtered incident subsets instead of only the top row
3. **HSE mobile closeout speed**
   - enlarge supervisor closeout controls and make repeat-crew proof capture faster on phones
   - tighten dispatch and route-stop signoff flow for small screens
4. **Accounting review lane parity**
   - bring the same shortcut-lane treatment to stale source batches, sync exceptions, and posting review

> Last synchronized: April 12, 2026 (linked HSE review lanes, monitor shortcuts, admin drill-through, and schema 073)

## 2026-04-11 admin focus buttons, HSE action items, and monitor threshold pass
- Fixed the inactive Admin hub buttons for **Linked HSE Packets** and **Analytics / Traffic Monitor** by wiring them directly into the backbone selector and record focus flow.
- Added migration `sql/071_admin_focus_hse_action_items_and_monitor_summaries.sql`.
- Added DB-backed `v_hse_packet_action_items`, `v_app_traffic_daily_summary`, and `v_monitor_threshold_alerts` so Admin can review HSE closeout blockers, daily traffic totals, and threshold-style monitoring alerts without reading only raw rows.
- Extended Admin directory/selectors/UI so HSE packets and monitoring entities now surface actionable follow-up instead of just lists.
- Continued the HSE/accounting direction by making open safety follow-up and open journal-drift pressure more visible inside the same Admin shell.

## Immediate next build priorities after 071
1. **Monitor dashboard actions**
   - add one-click jump from threshold alerts into the exact incident/filter set that caused the warning
   - add dismiss/snooze rules for known noisy alerts
2. **HSE mobile closeout speed**
   - add larger supervisor closeout actions and faster proof capture for repeat crews
   - tighten dispatch-specific signoff on small screens
3. **Accounting review tooling**
   - add clearer exception-to-batch drill-through for source-generated journals
   - expose stale-source aging and last-reviewed timestamps more prominently
4. **Repeat-save and fallback hardening**
   - keep tightening partial-save messaging and cached fallback behavior on dense Admin screens

> Last synchronized: April 11, 2026 (admin focus buttons, HSE action-item summaries, and monitor threshold pass)

## 2026-04-11 HSE upload retry, analytics traffic, and monitor pass
- Added migration `sql/070_hse_upload_retry_and_analytics_monitoring.sql`.
- Added route execution attachment uploads and HSE packet proof uploads with the same failure-trail behavior already used for job comments and equipment evidence.
- Added DB-backed `app_traffic_events` and `backend_monitor_events` so Admin can review page traffic, route views, API errors, upload failures, and runtime incidents from the backbone shell.
- Added Admin-facing upload retry/replacement flow for route execution attachments, HSE proofs, and previously logged upload failures.
- Continued the standalone-capable HSE direction while tightening the last major OSHA-oriented field proof and closeout screens.

## Immediate next build priorities after 070
1. **Monitor dashboards and alert thresholds**
   - surface daily/weekly monitor summaries instead of only raw incident rows
   - add escalation thresholds for repeated upload failures and repeated API/runtime incidents
2. **Dispatch/mobile field closeout polish**
   - tighten dispatch-specific supervisor signoff and route-stop closeout gestures on phones/tablets
   - make proof capture faster for repeat crews
3. **Analytics attribution depth**
   - add richer referral/source tagging and popular-route summaries for admin review
   - connect analytics to marketing/local-search experiments later
4. **Validation and repeat-save hardening**
   - continue tightening dense Admin screens so partial-save and repeat-save paths stay safe

## 2026-04-11 HSE OSHA interface, packet events, and field signoff pass
- Added migration `sql/069_hse_osha_interfaces_weather_chemical_traffic_signoff.sql`.
- Extended `linked_hse_packets` so packets can stay standalone-capable while also linking to jobs, sites, work orders, routes, equipment, and dispatches.
- Added DB-backed `hse_packet_events` for weather checks, heat checks, chemical handling, traffic/public interaction, field signoff, closeout, reopen, and general hazard notes.
- Extended Admin selectors/directory/manage/UI so HSE packets now expose packet scope, unscheduled-project fields, monitoring/signoff states, and event-level workflow tracking.
- Added cached Admin-directory fallback so the last good operations/HSE view can still load when the live admin fetch fails.

## Immediate next build priorities after 069
1. **HSE upload reliability completion**
   - add the same retry/failure trail to route execution and HSE proof uploads end to end
   - add direct retry actions from packet/event/proof records
2. **Dispatch and route field execution polish**
   - connect packet events more tightly to route-stop execution and dispatch completion
   - simplify mobile-first supervisor signoff and exception acknowledgment
3. **Source journal review tooling**
   - keep pushing guided refresh/rebuild/review for stale source batches
   - surface manual override reasoning more clearly for audit review
4. **Validation and repeat-save hardening**
   - continue tightening dense Admin screens so partial-save and repeat-save paths stay safe

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

## Immediate next build priorities after 068
1. **Source journal review tooling**
   - add guided refresh/rebuild/review flows for stale or exception-heavy source batches
   - make posted-source drift and manual overrides easier to audit
2. **Upload retry / fallback reliability**
   - extend the same failure visibility to route execution attachments and HSE proof uploads
   - add clearer retry ownership and field-office handoff notes
3. **Validation and repeat-save reliability**
   - continue hardening create/update/delete flows so Admin screens stay repeat-save safe
   - deepen user-facing partial-success messaging on dense screens
4. **Route and HSE mobile polish**
   - keep tightening mobile-first stop execution, proof capture, and exception review

## Immediate next build priorities after 066
1. **Source-to-journal automation**
   - move from manual journal batches into source-generated draft batches from AR/AP, receipts, and operations events
   - keep explicit post/review controls and clearer audit exceptions in Admin
2. **Route execution lifecycle**
   - add stop-complete, skipped, delayed, and route-stop note/photo state for daily field work
   - surface route execution progress and exceptions more clearly on mobile
3. **HSE proof and reopen workflow**
   - attach photo/file/signature proof to linked HSE packets
   - support closeout evidence review, reopen, and exception notes
4. **Route execution lifecycle**
   - add stop-complete, skipped, delayed, and note/photo state for route-stop execution

## What moved forward in 064
- material-receipt rollups now separate total received cost from allocated and unallocated cost
- work-order rollups now expose receipt count, received cost, unallocated receipt cost, and a rough operational status
- AR/AP rollups now expose posted amount, open amount, and posted percentage so Admin can see partial progress more clearly
- Admin selectors and forms now pull in these rollups and use smarter defaults from linked records

## Immediate next build priorities after 063
1. **GL posting and audit visibility**
   - move from invoice/bill balance rollups into actual journal-batch generation and posting controls
   - expose posted/unposted state clearly in Admin
2. **Receiving-to-usage progression**
   - add material issue/usage records so received material can move from purchase into job consumption and variance
   - expose rough actual-vs-estimated material cost at work-order level
3. **HSE packet proof and closeout**
   - attach images/files/signatures directly to linked HSE packets
   - add mobile-first closeout proof capture, field notes, and reopen logic
4. **Route execution polish**
   - add stop-complete, skipped, delayed, and note/photo state for daily route work

- Added DB-first workflow logic so estimate, work-order, and material-receipt header totals can roll up from their line records instead of depending on manual entry.
- Added receivables/payables payment-application logic so invoices and bills can track paid amounts, remaining balance, and partial/paid status from posted payments.
- Added receiving-to-costing linkage so material receipt lines can feed received quantity / received cost visibility back into work-order execution.
- Extended linked HSE packets toward real progress and closeout handling with checklist-style completion fields, derived progress, and clearer Admin-side visibility.


## 2026-04-08 landscaping/construction/mobile/admin-ui pathway documentation pass
- Refreshed the Markdown set to move the product direction from schema-only groundwork into the next implementation phase: admin UI managers for estimates/work orders, materials/units, routes/service areas, subcontract dispatch, and AR/AP + chart of accounts.
- Added a clearer rationale for keeping HSE as a first-class standalone module that can later link to jobs, sites, and dispatches for landscaping, project, and subcontract work.
- Updated the docs to emphasize mobile-first field use, desktop-strong admin depth, DB-first shared data, and local SEO / one-H1 discipline on every public build pass.

## 2026-04-07 estimates/work-orders/routes/materials/subcontract/GL foundation pass
- Added schema foundation migration `061_estimates_work_orders_routes_materials_and_gl_foundation.sql` so the repo now has first-class tables for estimates, work orders, routes, materials, subcontract dispatch, receivables, payables, and general-ledger journals.
- Reframed the roadmap so the next implementation phase is no longer “prove the shell exists” but “complete the digital admin/operations/accounting backbone”.

# Development Roadmap

## April 9, 2026 deeper workflow polish pass
- Move the Admin UI from backbone master-data maintenance into operational use of the new tables.
- Primary screens to finish next: estimate/work-order lines manager, route-stop manager, AR/AP payment posting, material receiving, and linked HSE packet manager.
- Keep the HSE app usable as a standalone safety workflow for unscheduled jobs, but add link points to work orders, routes, dispatches, sites, and equipment whenever a formal job exists.
- Continue mobile-first field UX: large tap targets, short forms, offline-safe drafts, camera-first attachments, and simplified supervisor signoff on phones.

### Why this direction makes sense
- OSHA landscaping hazard guidance supports first-class HSE linkage because common landscaping and project-work risks include machinery/tools, slips/falls, lifting, vehicles, chemicals, and heat/weather exposure.
- Landscaping and construction-style jobs need job costing, route planning, progress invoicing, purchase/material receiving, and cost tracking, which is why the Admin UI should now actively use estimates, work orders, AR/AP, and GL tables rather than leaving them as passive schema.
- IRS recordkeeping and depreciation rules reinforce the need for digital, structured records for materials, equipment, receivables, payables, and standard business costs.


Last synchronized: April 11, 2026 (admin focus buttons, HSE action-item summaries, and monitor threshold pass)

## Immediate priorities

### 1) Admin UI on new operations/accounting tables
Turn the new foundation tables into working admin tools.
- estimate / work-order manager
- materials + units manager
- route / service-area manager
- subcontract dispatch manager
- AR/AP + chart-of-accounts admin screens
- equipment master manager under the same admin backbone


### 2) Admin backbone completion
Make Admin the true operational source of truth.
- staff directory and hierarchy
- dropdown/reference manager
- equipment master data + equipment listings
- jobs and work orders
- materials and costing categories
- service areas and route references
- estimate approval and conversion workflow

### 3) Estimates and work orders
Move from schema foundation into working admin UI and workflows.
- estimate create/edit/list/approve
- estimate lines for labour/material/equipment/subcontract items
- convert approved estimate to work order
- work-order line management
- work-order status history and approvals
- printable and mobile-friendly work packets

### 4) Materials and costing
Complete the digital cost backbone.
- materials catalog CRUD
- unit-of-measure management
- estimated vs actual material usage per work order/job
- labour, equipment, and subcontract cost capture
- standard cost and bill-rate maintenance
- profitability reporting later

### 5) Routes and service areas
Deepen the landscaping service model.
- service-area manager
- route manager
- route stop sequencing
- recurring service template to route stop generation
- supervisor/crew assignment by route
- mobile visit completion flow

### 6) Subcontract dispatch workflow
Support operator + equipment assignments to another firm.
- subcontract client records
- dispatch create/edit/list
- operator/equipment pairing
- dispatch time and cost capture
- dispatch billing and invoice generation
- optional HSE packet linking

### 7) Digital accounting foundation
Move toward a fully digital receivables/payables/general-ledger system.
- chart of accounts manager
- invoice and bill CRUD
- payments received / payments made
- journal batch posting workflow
- tax handling rules
- standard cost account mapping
- later bank reconciliation and financial statements

### 8) Standalone HSE continuity
Keep HSE operational without requiring a full operations job.
- standalone forms remain first-class
- optional later linking to jobs/sites/clients/work orders/routes
- shared safety categories and templates from admin backbone

## Secondary priorities

### 9) Mobile-first field optimization
- quicker mobile navigation
- progressive disclosure on forms
- camera/upload friendly steps
- offline-safe drafts and retries
- faster repeat data entry from shared dropdowns
- route-stop quick-complete actions

### 9) Validation and save reliability
- repeat-save safe endpoints
- stronger input validation
- clearer save success/failure messages
- protect against stale async overwrites

### 10) Ongoing public SEO pass
On every build:
- one H1 on exposed pages
- refine local-service titles/meta for landscaping, construction support, and subcontract equipment/operator terms
- keep private/admin pages noindex
- continue route-by-route cleanup for local search visibility

## Move up next
- admin UI for estimates/work orders/materials/routes/subcontract dispatch
- complete database-first replacement of remaining shared JSON operational data
- start AR/AP and chart-of-accounts admin surfaces

## April 8, 2026 moved forward
- Added an HSE / OSHA Operations Hub concept to the Admin interface so the safety workflows stay first-class and easier to access for field supervisors and office admins.
- Added an Operations and Accounting Backbone Manager concept so Admin can maintain units, cost codes, service areas, routes, clients, client sites, materials, equipment, estimates, work orders, subcontract dispatch, vendors, and accounting masters from one workflow area.
- Move up next: deepen the Admin screens for line-level estimate/work-order items, AR/AP payment posting, purchase-order style material receiving, and linked HSE packets for work orders and dispatches.

## Why this direction makes sense
- OSHA landscaping guidance highlights recurring machinery, lifting, heat/weather, slips, vehicle, and tool hazards, so HSE must stay linked to sites, jobs, routes, equipment, and dispatches.
- Project-based landscaping and construction work needs job costing, progress invoicing, purchasing, inventory/material control, and work-order discipline, so the operations backbone should continue toward estimates, work orders, AR/AP, and the general ledger.
- IRS treatment of business expenses, inventory/materials, and depreciable equipment supports keeping materials, equipment, and accounting data fully digital and structured.

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
- Next strongest follow-up: crew dispatch board, recurring job generation/instance handling, and richer worker-facing photo/comment moderation with offline-safe upload retry.

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

