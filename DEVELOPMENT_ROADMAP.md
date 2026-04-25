<!-- Reviewed during 2026-04-23 scheduler duplicate-dispatch guard, cache refresh, and repo-hygiene pass. -->
## Immediate next build priorities after 088 duplicate-dispatch guard
1. **Scheduler reliability verification**
   - confirm cron advances `next_run_at` after the Edge Function completes
   - watch for duplicate `service_execution_scheduler_runs` rows during a 10-minute window and keep the new queued-dispatch guard in place
   - next scheduler enhancement remains true invoice staging from logged invoice candidates
2. **Workflow test pass**
   - test attendance/HSE approve, reject, and follow-up with required notes
   - test signed-contract kickoff against both new and already-linked records
   - test payroll export delivered -> confirmed -> closed with delivery references and close notes
3. **Admin/mobile polish**
   - continue slimming dense Admin panels, especially evidence review and payroll close, for phone use
   - keep image score wording framed as rule-based completeness, not AI quality judgment

<!-- Reviewed during 2026-04-22 workflow guardrail, portable scheduler sync, and repo-alignment pass. -->
<!-- Reviewed during 2026-04-21 scheduler Vault sync, evidence review, signed-contract kickoff, and payroll-close repo alignment pass. -->
<!-- Reviewed during schema 087 evidence review, scheduler settings, and signed-contract kickoff pass on 2026-04-20. -->
## Immediate next build priorities after 087
1. **Scheduler live-path follow-through**
   - repo and live database are now aligned on a portable scheduler dispatch path: Vault-backed when available, with a fallback secret source when Vault is unavailable
   - next scheduler work is duplicate-run safeguards, richer invoice staging from scheduler payloads, and alerting when dispatch fails repeatedly
2. **Operational verification pass**
   - test the richer attendance/HSE approve-reject-follow-up workflow in real Admin usage
   - confirm the new rejected/follow-up note requirement feels clear in Admin
   - test signed-contract kickoff all the way through job, work order, and first planned session creation with real records
3. **Payroll closure finish**
   - verify provider delivery confirmation, payroll close signoff, and downstream accounting/journal handoff notes in office workflow
   - keep the new delivery-reference and close-note guardrails in place so payroll runs do not close with thin audit context

1. **Platform scheduler hookup**
   - call the service execution scheduler on a real timer using the new settings/status flow
   - add duplicate-run safeguards and per-setting last/next-run review
2. **Evidence review closure**
   - turn attendance/HSE evidence tables into richer media-review queues with supervisor approval notes
   - add clearer exception disposition actions from the same review shell
3. **Signed contract to live operations**
   - deepen kickoff from signed contract -> live job into signed contract -> job + work order + first planned session where appropriate
4. **Payroll close workflow**
   - add provider-delivery confirmation, export receipts, and payroll-close signoff
5. **Selector and dashboard slimming**
   - continue splitting Admin dashboard, evidence, and backbone loads into narrower scopes beyond the current `admin_core` improvement

<!-- Reviewed during schema 086 HSE ops performance and site-activity rollup pass on 2026-04-20. -->
## 2026-04-17 contract conversion, payroll export, callback dashboard, and snow-invoice automation pass
- Added migration `sql/083_employee_time_clock_and_break_tracking.sql`.
- Added estimate conversion candidates, service contract documents, payroll export generation, agreement profitability summaries, snow-event invoice candidates, and callback / warranty dashboard summaries.
- Extended Admin so the office workflow can move from estimate -> agreement -> printable contract, then from snow trigger -> invoice, and from weekly labor review -> exportable payroll output.

## Immediate next build priorities after 086
1. **Attendance photo evidence completion**
   - store and review clock-in/clock-out images directly in Admin with stronger exception workflows
2. **Service scheduler automation**
   - invoke the service execution scheduler on a real timer and prevent duplicate session creation once jobs are linked to agreements
3. **Payroll close and provider exports**
   - move from generated export content to provider-ready file delivery plus posted payroll-close review
4. **Signed contract execution**
   - convert signed contract/application acceptance into live job/session kickoff with less manual Admin work
5. **Issue closure and repo hygiene**
   - keep retiring stale helper/test files, continue reducing selector overfetch, and tighten dense Admin screens that still depend on broad payloads

## Immediate next build priorities after 081
1. **Contract outputs and acceptance flow**
   - add signed acceptance markers, printable application/contract variants, and acceptance-to-job kickoff controls
2. **Snow-event billing automation**
   - let triggered snow events batch into invoice staging and agreement-level revenue review
3. **Payroll close and accounting handoff**
   - turn generated CSV exports into stronger payroll close review with journal-ready summaries
4. **Callback / warranty operating cards**
   - surface callback backlog, warranty leakage, and unresolved revisit cost pressure more prominently in the admin shell
5. **Agreement profitability and property lifecycle**
   - keep tying recurring agreements, assets, callbacks, and route profitability together for repeat properties

## 2026-04-17 recurring service agreements, asset history, payroll review, and admin account tracking pass
- Added migration `sql/080_service_agreements_assets_payroll_and_login_tracking.sql`.
- Added DB-backed recurring service agreements with per-visit pricing fields, snow-trigger tracking, change orders, customer assets, warranty/callback records, payroll export runs, and login-event auditing.
- Extended accounting rollups with material-to-job auto-costing from receipts/issues, plus route profitability and payroll review summaries.
- Extended Admin so staff rows now show last-login visibility and login-event counts, while new service/agreement/accounting entities can be managed from the backbone shell.

## Immediate next build priorities after 080
1. **Estimate / contract conversion**
   - turn approved estimates and recurring service agreements into printable service contracts and accepted job starts
   - carry tax codes, per-visit billing, discount rules, and contract references through to jobs and invoices
2. **Crew dispatch and split handling**
   - let an active crew split into emergency, subcontract, or callback work without losing the original job timeline
   - tighten equipment reassign + return expectations at the crew/session level
3. **Payroll and invoicing closure**
   - connect payroll export runs to final invoice staging and posted-cost review
   - surface uninvoiced completed sessions and callback/warranty cost leakage more prominently
4. **Customer property intelligence**
   - keep adding repeat-property asset history, site notes, trigger thresholds, and visit outcomes so repeat work becomes faster to price and safer to schedule

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

## Immediate next build priorities after 074
1. **Packet create/open from Jobs, Equipment, and Dispatch**
   - let adjacent workflow shells create or open the right linked packet in-context
   - carry crew, supervisor, equipment, and site defaults automatically
2. **Worker-facing packet capture speed**
   - mirror the new Admin cue fields in worker-friendly phone forms where the packet exists
   - keep offline/outbox behavior for packet-event evidence and closeout notes
3. **Monitor actions**
   - add resolve / snooze / assign actions for noisy monitor lanes and repeated upload failures

## Carried-forward follow-on items
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

- Staff/admin reliability: completed a compatibility fallback for `admin-manage` so staff creation and profile saves can fall back to a same-origin route when direct Edge Function calls stall, time out, or return HTML. Next pass should add a visible timed-out / retry message beside the Create Staff User button if both direct and compatibility paths fail.

## 2026-04-14 landscaping job families, recurring service cadence, and crew planning pass
- Added migration `sql/075_landscaping_job_workflow_and_crew_planning.sql`.
- Jobs now model the real service mix more clearly: one-time landscaping, recurring property service, snow / winter work, park work, home-modification work, and larger custom construction/project jobs.
- Crew planning now includes crew kind, optional crew lead, service-area alignment, and default equipment notes so the same crew can be reused across weekly and custom jobs.
- Job planning now includes service pattern, recurrence basis/custom-day notes, estimated visit minutes, reservation windows, reservation notes, and equipment-planning status so equipment can be reserved for either one-time jobs or repeating work windows.
- Equipment overlap checks now use reservation windows first, then fall back to start/end dates, which makes repeating lawn, snow, foliage, and route-style work safer to plan without overbooking shared equipment.
- Next strongest follow-up: recurring job instance generation, crew board / day sheet, and reservation calendar visibility across jobs, routes, and dispatches.

## 2026-04-14 profile route recovery and Ontario accounting guidance pass
- Fixed the `#me` route startup weakness by initializing profile/crew async load counters correctly, re-running profile layout when the route becomes visible, and leaving a visible fallback shell in the HTML so the screen never looks empty while modules load.
- Added an Ontario-facing accounting helper to the Admin accounting stub so subtotal, HST/GST-HST, and total are easier to work with while the fuller tax engine is still pending.
- Added `docs/ONTARIO_ACCOUNTING_AND_TAX_GUARDRAILS.md` so the landscaping/client/job/employee/accounting direction now has a written Ontario/CAD baseline instead of only ad-hoc notes.

## Immediate next build priorities after 075
1. **Crew-to-job reservation enforcement**
   - carry crew assignment deeper into equipment pool reservations and route/service execution
   - show reservation conflicts and missing equipment readiness before job start
2. **Ontario tax settings in the DB**
   - add business tax settings, tax classes, and invoice/bill defaults instead of keeping the Ontario HST helper only in UI text
   - preserve place-of-supply overrides, zero-rated, and exempt cases
3. **Client/job/finance convergence**
   - keep pricing able to run standalone, but make estimates, work orders, invoices, bills, and payments trace cleanly to client, site, job, and dispatch records
4. **Profile/settings reliability**
   - keep tightening the My Profile and Settings screens so route startup, save messaging, and cached fallback behavior are dependable on slower connections

## 2026-04-15 pass – landscaping pricing and profitability backbone
Completed this pass:
- jobs now support cost-to-us, quoted charge, markup %, discount mode/value, tiered discount notes, estimated profit, margin %, and actual profit tracking
- jobs now support approximate duration hours/days, open-end jobs, delay flags, delay cost, and equipment repair cost hooks
- jobs-manage now calculates pricing server-side so margin math is not UI-only

Next recommended build steps:
1. feed job pricing into estimates and work orders so accepted quotes can become operational jobs without re-entry
2. add Ontario HST tax-code tables and posting rules so taxable jobs, invoices, and bills stop relying on helper-level defaults
3. tie delayed jobs and equipment repair cost into accounting review queues and profitability dashboards
4. add contract templates and estimate-to-job conversion once this costing layer is stable

### Current next step after 077
- Use the new tax-code, business-tax-setting, and service-pricing-template admin backbone screens to stabilize Ontario HST defaults and reusable landscaping/service pricing before estimate-to-contract conversion.
- Next strongest follow-on: estimate templates, contract generation, and tax posting rules that consume the new DB-backed pricing/tax records instead of manual notes.



## April 15, 2026 follow-on pass
- Land the new session-level workflow for jobs:
  - track each mowing/plowing/recurring visit as an individual job session with start, end, duration, and site-supervisor signoff
  - log crew-member hours against each job session for payroll/invoicing crossover
  - log job reassignments for emergency crew splits, service-contract support, and equipment redirects
- Next strongest continuation after this pass:
  - estimate-to-job conversion with service templates
  - contract/service agreement generator tied to job family and recurrence
  - Ontario tax posting rules and invoice posting from job/session totals

## 2026-04-16 accounting profitability and landscaping service-business pass
- Added job-financial rollups so the app can move from job scheduling into real profitability review.
- Added labor-rate fields to staff records so crew hours can be valued for costing and billing review.
- Added job financial events so delays, repairs, subcontract help, fuel, disposal, permits, and revenue adjustments stop living only in notes.

## Immediate next build priorities after 079
1. **Estimate / contract / service-package conversion**
   - convert service pricing templates into estimate lines and contract-ready service bundles
   - support recurring service agreements, snow triggers, and seasonal packages
2. **Invoice and payroll bridge**
   - convert completed/signed sessions into invoice-ready labor and service totals
   - connect crew-hour cost review to payroll export / labor burden assumptions
3. **Job-cost detail by source**
   - split profitability by labor, materials, equipment repair, subcontractors, fuel, and delays
   - surface margin erosion alerts before invoicing is finalized
4. **Ontario accounting controls**
   - deepen tax-code handling, invoice tax posting, vendor-bill tax capture, and year-end accounting guardrails for Ontario/Canada workflows
> Synchronized for the 2026-04-16 accounting-profitability and job-financial-rollup pass.


## 2026-04-19 employee time clock and attendance pass

- Added DB-backed `site_activity_events`, `v_site_activity_recent`, and `v_site_activity_summary` so Admin can review durable activity for staff creation/updates, new jobs, equipment changes, agreements, payroll exports, contracts, and related operational changes.
- Admin now loads and renders a Recent Site Activity table directly from the backend instead of relying only on login traces or per-screen notices.
- `admin-manage`, `jobs-manage`, and `account-maintenance` now record key activity events while still failing safely if the audit trail insert itself has a problem.
- Current schema target is now 082.


### Next after 082

1. Surface per-entity activity filters in Admin so managers can narrow to Jobs, Staff, Equipment, Contracts, or Accounting events.
2. Add invoice-posted, payment-posted, and equipment-maintenance-completed events into the same activity stream.
3. Add downloadable audit exports for date ranges to support admin review and basic compliance/archive needs.


## 083 Employee site time clock pass
- Added employee site/job sign-in, unpaid break, resume, and sign-out flow tied to job sessions and payroll-linked crew-hour rows.
- Added admin-visible employee time entry records and recent attendance summary data.
- Added site activity audit coverage for clock in, break start, break end, and clock out.
- Next direction: supervisor approval for employee clock exceptions, geofence/photo proof on arrival, payroll export file generation, and contract/estimate conversion polish.


## 084 Supervisor attendance review and execution candidate pass
- Added migration `sql/084_supervisor_attendance_review_and_execution_candidates.sql`.
- Added supervisor review data for missed clock-out, long-break, and attendance exceptions.
- Added browser geolocation and photo-note capture fields to employee time entries at clock in/out.
- Added operations dashboard summary counts for active crews on site, overdue sign-outs, unsigned sessions, delayed jobs, and loss-making jobs.
- Added recurring service agreement execution-candidate rules so the Admin side can stage session and invoice candidates from active agreements.
- Next direction: geofence radius rules, actual photo upload on clock actions, scheduled execution generation, and finalized payroll provider exports.

## Current 085 focus
- Complete the employee time clock with stored attendance photos and geofence exception handling.
- Push recurring agreements from passive records into scheduler-driven service session creation.
- Keep payroll export generation provider-aware instead of one generic CSV.
- Move contract flow toward signed-document to invoice conversion.
- Next strongest pass: actual scheduled invocation, signed file upload capture for contracts, and richer dashboard cards from scheduler and invoice candidate views.


## 2026-04-21 implementation pass

### Completed in this pass
- Wired scheduler settings into actual execution logic, including lookahead filtering, auto-create session behavior, invoice staging counters, and next-run updates.
- Added cron-dispatch schema support so the scheduler can be driven from database-backed timing rather than manual-only runs.
- Converted evidence review from read-only links into approve / reject / follow-up workflow controls backed by a review table.
- Deepened signed-contract kickoff from “candidate only” into live job + work order + first planned session creation.
- Added payroll delivery confirmation and payroll close signoff states after export generation.
- Kept one public H1 on the main page, bumped cache versions, and continued CSS drift cleanup around review tables/actions.

### Best next steps after this pass
1. Wire environment/config deployment for the scheduler secret and invoke URL in each environment, then verify pg_cron dispatch history in Supabase.
2. Add invoice staging actions from scheduler candidates so invoice candidate counts can turn into draft invoices from the same Admin workflow.
3. Extend payroll-close with export receipt upload / signed acknowledgement document support.
4. Add a dedicated work-order details drill-down after signed-contract kickoff so supervisors can confirm route, packet, and crew assignment from one screen.
5. Continue JSON-to-DB cleanup where duplicate state still exists in admin summaries or selector payloads.

## 2026-04-22 workflow polish update
- Scheduler SQL now needs to stay portable across environments: hosted Supabase can use Vault, but canonical repo SQL must keep the non-Vault fallback.
- Payroll export workflow now expects a full delivered -> confirmed -> closed progression in Admin.
- Image scoring guidance is now documented as a rule-based completeness score rather than an AI quality score; a future merchandising pass can add blur, exposure, duplicate-angle, and lifestyle bonuses/penalties.

## 2026-04-24 auth wall, historical reports, and OSHA reporting pass
- Fixed the public auth wall so logged-out users no longer see the live Toolbox Talk, PPE Check, First Aid Kit, Site Inspection, or Emergency Drill screens underneath the sign-in interface.
- Added a supervisor/admin **Historical Reports** screen with export-ready HSE form history, site/form rollups, and cross-workflow history covering submissions, HSE packet events, evidence review, scheduler runs, payroll exports, and signed contracts.
- Added migration `sql/089_historical_reporting_and_auth_wall_support.sql` and synced the full schema reference so reporting stays DB-backed instead of drifting into browser-only JSON snapshots.
- Continued the OSHA-facing direction by keeping the five field forms first-class while making their historical retrieval and review more usable for office and supervisor follow-up.
- Next strongest follow-up: add incident / near-miss reporting, saved report presets, richer trend charts, and deeper drill-down exports by site, worker, route, and work-order context.



### Historical reporting direction now started
- Historical Reports screen is now the main place to retrieve HSE form history plus payroll/scheduler/contract workflow history without opening each workflow separately.
- Next strongest follow-up: incident / near-miss form, saved report presets, chart summaries, and deeper worker/site/route/work-order drilldowns.
- Keep pushing DB-backed reporting views rather than local-only JSON summaries so exports and office follow-up remain consistent across sessions.

## 2026-04-24 incident reporting, DB-backed report presets, and richer HSE analytics pass
- Added a new **Incident / Near Miss** field form so workers and supervisors can capture injuries, close calls, damage, witness names, immediate actions, and corrective-action ownership without waiting for office follow-up.
- Added migration `sql/090_incident_reporting_saved_report_presets_and_trends.sql`.
- Added DB-backed reporting presets (`report_presets`) so supervisors and admins can reuse saved report filters without depending on local browser storage.
- Expanded reporting with DB-backed views for incident history, monthly trends, worker rollups, and site/job/route context rollups.
- Reworked the historical reports screen to use the richer DB-backed datasets and added incident CSV export.
- Added a dedicated incident quick link in the public nav, HSE Ops, and Admin hub so the OSHA-facing workflows stay easy to reach on mobile and desktop.
- Next strongest follow-up: training history + certification expiry, SDS acknowledgement tracking, OSHA 300/300A/301-oriented recordkeeping helpers, and corrective-action task assignment from incident rows.

## 2026-04-25 corrective actions + training pass
- Synced the repo to include first-class corrective-action tasks, training / certification expiry tracking, SDS acknowledgement history, and management-focused reporting.
- See `docs/CORRECTIVE_ACTIONS_AND_TRAINING.md` and the new `sql/091_corrective_actions_training_and_sds_tracking.sql` migration.


## Next step after migration 092
- Wire actual scheduled delivery for `report_subscriptions` using the existing scheduler/backbone.
- Add corrective-action reminder dispatch history and escalation policy rules by priority.
- Build worker-facing acknowledgement UI for self-service training and SDS prompts.
- Add equipment-specific JSA review forms tied directly to jobs, route stops, and packets.
