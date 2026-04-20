<!-- Reviewed during schema 084 supervisor attendance / execution-candidate pass on 2026-04-19. -->
<!-- Reviewed during schema 080 recurring agreements / payroll / asset history / login tracking pass on 2026-04-17. -->
## 2026-04-17 pass update
Closed or tightened in this pass:
- recurring agreements are no longer only a roadmap concept; they now have DB-backed records with per-visit pricing and snow-trigger support
- account access now has Admin-visible last-login tracking and login-event rollups instead of only raw auth assumptions
- accounting can now see material-to-job auto-cost rollups from receipts/issues and payroll-review/export pressure more clearly
- customer asset history and warranty/callback tracking now exist as first-class records instead of only notes-only workarounds

Remaining strongest gaps:
- contract document generation and estimate-to-agreement conversion are still pending
- payroll export is tracked/reviewed, but export-file generation and close-the-loop posting is still pending
- route profitability and customer asset history are DB-backed, but still need dedicated dashboard cards and drill-through UX
- crew split / emergency reassignment still needs deeper live-operational UI beyond the current data structures

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

- **Moved forward:** HSE packets no longer rely only on broad notes for machinery, lifting, weather/heat, and chemical/public review.
- **Still open:** worker-facing packet-event capture still needs a more direct phone-first packet UI outside Admin.
- **Still open:** Jobs, Equipment, and Dispatch still do not open/create linked packets in-context from their own screens.

> Last synchronized: April 12, 2026 (HSE control cues, inspection focus, and schema 074)

> Last synchronized: April 12, 2026 (linked HSE review lanes and monitor shortcut pass)

## 2026-04-11 update after 071
- The inactive Admin hub buttons for Linked HSE Packets and Analytics / Traffic Monitor are now fixed, so the next gap is not navigation but deeper drill-through and mobile speed.
- HSE packet follow-up is now easier to review because action-item summaries call out reopen, missing signoff, missing monitoring steps, and packets ready for closeout.
- Analytics/monitoring is now stronger because Admin can see daily traffic summaries and threshold alerts, but the next step is direct dashboard filters and escalation handling.
- Accounting visibility improved indirectly because open journal sync exceptions now contribute to alert-threshold review rather than hiding among raw record lists.

> Last synchronized: April 11, 2026 (admin focus buttons, HSE action-item summaries, and monitor threshold pass)

## 2026-04-11 HSE OSHA interface, packet events, and field signoff pass
- Added migration `sql/069_hse_osha_interfaces_weather_chemical_traffic_signoff.sql`.
- Added packet-scope, unscheduled-project, weather/heat/chemical/traffic, and field-signoff fields to linked HSE packets.
- Added DB-backed `hse_packet_events` so the OSHA-facing workflows now have a first-class event trail instead of relying only on packet notes and proof rows.
- Extended Admin with event-level packet management and a cached fallback for last-good admin data when live loading fails.

## Highest-value remaining gaps now
- HSE proof uploads still need the same retry/failure flow depth that comment/equipment uploads now have.
- Route-stop execution, dispatch completion, and HSE closeout still need tighter mobile-first linking.
- Source-generated journal review/rebuild is still the strongest accounting/admin gap after this HSE pass.

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

## What moved forward in this pass
- manual header totals are no longer the only model for estimates, work orders, and receipts
- AR/AP records now have a stronger balance-driven direction
- HSE packets are moving from a simple link record toward a real progress/closeout packet

## Highest-value remaining gaps now
- GL posting remains incomplete even though AR/AP balance rollups are stronger
- inventory movement is still partial because receipt-to-on-hand / issue / usage is not yet complete
- route-stop execution and crew-day flow are still lighter than the costing/accounting side
- HSE packets still need attachments, proof capture, and richer closeout evidence

- Added DB-first workflow logic so estimate, work-order, and material-receipt header totals can roll up from their line records instead of depending on manual entry.
- Added receivables/payables payment-application logic so invoices and bills can track paid amounts, remaining balance, and partial/paid status from posted payments.
- Added receiving-to-costing linkage so material receipt lines can feed received quantity / received cost visibility back into work-order execution.
- Extended linked HSE packets toward real progress and closeout handling with checklist-style completion fields, derived progress, and clearer Admin-side visibility.


## 2026-04-08 landscaping/construction/mobile/admin-ui pathway documentation pass
- Refreshed the Markdown set to move the product direction from schema-only groundwork into the next implementation phase: admin UI managers for estimates/work orders, materials/units, routes/service areas, subcontract dispatch, and AR/AP + chart of accounts.
- Added a clearer rationale for keeping HSE as a first-class standalone module that can later link to jobs, sites, and dispatches for landscaping, project, and subcontract work.
- Updated the docs to emphasize mobile-first field use, desktop-strong admin depth, DB-first shared data, and local SEO / one-H1 discipline on every public build pass.

## 2026-04-07 estimates/work-orders/routes/materials/subcontract/GL foundation pass
- Added schema foundation migration `061_estimates_work_orders_routes_materials_and_gl_foundation.sql` so the repo now has concrete tables for the operations/accounting direction that had previously been only in roadmap notes.
- With the current build reported as stable, the biggest remaining risks shift from shell repair toward implementation depth, validation quality, and operational/accounting convergence.

# Known Issues and Gaps

## April 10, 2026 issue/gap refresh
- The schema snapshot gap is now corrected: the full reference file includes the newer workflow migrations instead of only referencing them in comments.
- Receipt allocation visibility is stronger, but true inventory issue/usage tracking is still incomplete.
- Posted/open amount visibility is stronger, but explicit journal posting and audit controls are still incomplete.
- Work-order operational state is now easier to see, but route execution and proof-heavy HSE closeout still need deeper workflow screens.

## April 9, 2026 issue/gap refresh
- Open implementation gaps now concentrate on deeper workflow use of the new tables, not on whether the tables exist.
- Priority open screens: estimate/work-order lines, route stops, AR/AP payments, material receiving, and linked HSE packet management.
- Keep tracking CSS/mobile drift on admin manager screens as they grow.
- Continue reducing duplicate JSON/shared-reference sources wherever DB-first selectors already exist.


Last synchronized: April 11, 2026 (admin focus buttons, HSE action-item summaries, and monitor threshold pass)

## 1) Admin backbone incompletion
### Risk
The admin side is growing, but it is not yet the complete source of truth for all shared operational data.

### Needed
- staff management depth
- equipment manager using equipment master data
- estimate/work-order manager
- materials/costing manager
- route and service-area manager
- receivables/payables/accounting setup manager
- shared dropdown/reference control for all major forms

## 2) Validation and repeat-save risk
### Risk
Some forms have shown “saves once, fails later” behavior or insufficient validation feedback.

### Needed
- repeat-save validation
- clearer success/failure messages
- idempotent update paths where appropriate
- stronger server-side validation for critical records

## 3) Landscaping workflow gap
### Risk
The current build has jobs/equipment/HSE foundations, but not yet the full landscaping operations lifecycle.

### Needed
- recurring service templates
- route stops and scheduling
- visit completion flow
- material usage and costing
- client/site history per property

## 4) Project/construction workflow gap
### Risk
One-off project work like splash pads, parks, and construction support is only partially represented.

### Needed
- estimate -> approved work order -> phase tracking
- milestone/progress structure
- job packet / forms bundle
- equipment and materials planning

## 5) Subcontract dispatch gap
### Risk
Sending an employee or operator+machine to another company needs dedicated operational support.

### Needed
- subcontract client records
- dispatch work orders
- operator/equipment pairing
- time/billing/cost capture
- linked safety requirements

## 6) Digital accounting gap
### Risk
The repo now has schema foundations for AR/AP/GL, but not yet the complete admin workflow.

### Needed
- chart of accounts manager
- invoice and bill manager
- payments received and payments made
- journal batch/posting controls
- tax mapping and standard cost mapping
- later financial statements and reconciliation

## 7) Standalone HSE linkage gap
### Risk
The HSE app must stay usable alone, but later linking those records to jobs/sites/clients/work orders should be smoother.

### Needed
- standalone mode remains first-class
- optional link-back to operations records later
- shared safety templates and categories

## 8) CSS/mobile drift risk
### Risk
The UI continues to drift visually across screens and devices.

### Needed
- routine CSS QA
- mobile-first control sizing
- stronger empty states and loading states
- keep admin screens usable on desktop and acceptable on tablet/mobile

## Highest-priority summary
1. admin backbone completion
2. validation and repeat-save reliability
3. landscaping/project/subcontract workflow depth
4. digital accounting implementation
5. standalone HSE continuity

## Why this direction still matters

The business model mixes recurring landscaping, project/construction work, subcontract dispatch, and standalone HSE activity. Because of that, the highest-value remaining work is no longer just shell stability. It is converging the admin backbone, shared DB-backed catalogs, mobile field use, and digital accounting support into one coherent operations platform.

Reference links:
- OSHA landscaping hazards: https://www.osha.gov/landscaping/hazards
- OSHA landscaping overview/standards: https://www.osha.gov/landscaping
- IRS Publication 334: https://www.irs.gov/publications/p334
- IRS Publication 946: https://www.irs.gov/publications/p946
- IRS Tangible Property Regulations FAQ: https://www.irs.gov/businesses/small-businesses-self-employed/tangible-property-final-regulations

## Highest-value next implementation pass
- estimate / work-order manager
- materials + units manager
- route / service-area manager
- subcontract dispatch manager
- AR/AP + chart-of-accounts admin screens
- tighter HSE linking from standalone records into jobs/sites/work orders/dispatches when appropriate

## April 8, 2026 implementation focus
- Complete the Admin UI around the new backbone tables with stronger validation, record linking, and mobile-safe editing.
- Keep HSE standalone while also supporting direct linkage from work orders, routes, dispatches, and equipment.
- Continue retiring duplicate JSON fallback points when the DB-backed managers become stable enough for daily use.

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
- Remaining gap: recurring schedules are stored and editable, but automatic future instance generation and calendar-grade recurrence expansion still need a dedicated follow-up pass.


## April 10, 2026 update after 066
- The repo now has explicit journal-batch controls and material issue / usage records, so the next operational blind spots are route-stop execution, HSE proof/reopen, and automatic source-to-journal drafting.
- Validation risk remains important because posting should be blocked on imbalance and issue/usage flows still need live field testing with real work-order data.
- CSS/mobile drift remains active because the Admin backbone is carrying more dense controls in a single screen.

## 2026-04-10 source-generated journals, route execution, and HSE proof pass
- Added migration `sql/067_source_journal_route_execution_and_hse_proof.sql`.
- Added source-generated draft journal batches for AR invoices, AP bills, material receipts, and material issues so review/posting can start from the originating record instead of manual batch creation.
- Added route-stop execution lifecycle records plus attachment rows so daily field work can track completed, skipped, delayed, and exception states with note/photo support.
- Added HSE proof rows plus reopen-aware linked packet fields so closeout evidence, reopen counts, and follow-up exceptions are visible in the Admin backbone.
- Continued the DB-first move for shared operational/accounting data and refreshed the docs so roadmap, risks, testing, and deployment all point to the same next state.


## April 10, 2026 update after 067
- Source-generated journal drafting now exists, so the next accounting risk shifts from batch creation into audit visibility when posted batches later diverge from changed source records.
- Route-stop execution and HSE proof records now exist in the DB/admin layer, so the next risk is mobile capture polish and live storage/upload testing rather than missing structures.
- CSS/mobile drift remains active because the Admin backbone now carries denser execution/proof/accounting controls in one shell.


## April 11, 2026 update after 068
- Added explicit review visibility for stale/unbalanced/missing-entry source journal batches, reducing the risk that posted-source drift is missed in Admin.
- Added upload-failure logging for job comment attachments and equipment evidence so field staff and office admins have a visible fallback path when storage or metadata writes fail.
- Remaining next step: extend the same fallback/retry visibility to route execution attachments and HSE proof uploads, then add more guided review actions for stale source batches.


## April 11, 2026 update after 070
- The remaining HSE interface gap is no longer missing packet/event/proof structures. The main gap is now dashboard polish, alert thresholds, and mobile supervisor speed for repeat field closeout.
- Upload-failure handling is now broader because job comments, equipment evidence, route execution attachments, and HSE proofs all have a DB-backed failure trail and retry ownership path.
- The new analytics/monitoring layer reduces the risk that traffic drops, API failures, upload failures, or client-side runtime issues go unseen, but it still needs dashboard-style summaries and alerting thresholds.

## 2026-04-11 HSE operations hub and admin section-button pass
- Added a separate **HSE Operations** screen outside the long Admin page so safety workflows, OSHA-oriented reminders, and linked-packet shortcuts can be reached more quickly on desktop and mobile.
- Split the Admin experience into section buttons so people/access, jobs/operations, safety/monitoring, accounting, and messaging/diagnostics can be opened without one long scroll.
- Added migration `sql/072_hse_hub_and_accounting_review_summaries.sql` plus summary views for HSE follow-up and accounting review pressure.
- Corrected Admin selector/view alignment for traffic daily summary and HSE action-item ordering so the newer safety and monitoring shortcuts stay usable.
- Continued the DB-first direction while keeping HSE standalone-capable and easier to connect to jobs, work orders, routes, equipment, dispatches, sites, and subcontract work.

- Admin staff creation previously stalled on “Creating staff user…” with no visible app error when the direct `admin-manage` function path did not resolve. The frontend now falls back to `/api/auth/admin-manage`; verify the compatibility route is deployed in the same release as the UI update.

## 2026-04-14 status update
- **Improved this pass:** the data model now better matches the actual work mix: one-time landscaping, recurring maintenance/snow work, and large custom projects.
- **Improved this pass:** crews can now carry a crew kind, optional crew lead, service-area context, and default equipment notes instead of relying only on free-text notes.
- **Improved this pass:** jobs now have service-pattern and reservation-window fields so equipment planning is less dependent on loose start/end dates.
- **Still open:** recurring jobs still need true instance generation / calendar expansion instead of only storing the recurrence rule and summary.
- **Still open:** crews still need a dedicated board/day-sheet style view that shows lead, supervisor, members, equipment readiness, and HSE packet state together.
- **Still open:** equipment reservations still need a visual calendar / lane view for repeat weekly and seasonal work.

## April 14, 2026 issue/gap refresh
- The blank `#me` route weakness is now addressed in the frontend, but profile and settings screens still need continued reliability testing on slower startups and stale sessions.
- Landscaping direction is now clearer: one-time installs, recurring maintenance/snow work, and large custom projects all need to converge on the same client/job/crew/equipment/accounting backbone.
- Ontario/CAD tax handling is now documented, but the live application still relies on helper-level HST defaults rather than a DB-backed tax-code engine.

## Accounting legislation / compliance gap
### Risk
The accounting foundation exists, but Ontario/CRA-facing tax behavior is still only partially represented in the live workflow.

### Needed
- Ontario business tax settings in the DB
- HST / GST-HST defaults and overrides by record type
- place-of-supply aware tax handling
- exempt / zero-rated handling
- invoice/bill print and posting rules that preserve subtotal, tax, and total separately
- month-end and year-end close review checklists tied to Canadian / Ontario operations

## 2026-04-15 – remaining gaps after pricing pass
Improved this pass:
- job records now carry commercial pricing inputs and profit/loss hooks instead of only schedule fields
- open-end jobs and delayed jobs now have explicit state instead of being buried in notes

Still open:
- no full Ontario tax-code engine yet for job-to-invoice and bill posting
- no estimate-to-contract-to-job conversion flow yet
- no automated profitability dashboard that blends jobs, receipts, equipment repair, and delay losses into one review screen
- recurring service pricing tiers still rely on notes/discount settings rather than reusable client/service pricing catalogs

### Pricing/Tax/Admin gap status
- **Improved this pass:** Ontario tax codes, business tax settings, and reusable service pricing templates are now DB-backed and editable in the Admin backbone UI.
- **Still open:** estimate/contract flows are not yet fully consuming these pricing templates end to end, and accounting posting still needs deeper Ontario-specific tax treatment and filing/report outputs.



## Jobs / Accounting / Landscaping workflow status
- Parent jobs now cover pricing, equipment planning, sessions, hours, and reassignment logging, but contract generation and estimate conversion are still open.
- Crew reassignment is now logged as an operational event and equipment reassignments update the target job, but permanent crew-structure editing still lives separately from active split handling.
- Ontario accounting logic still needs deeper posting controls for payroll-style labor costing, repair capitalization vs expense handling, and delayed-job cost recovery.

## 2026-04-16 accounting and landscaping workflow gaps still open
- Job financial rollups now exist, but **estimate-to-contract-to-invoice** conversion is still not complete.
- Crew hours can now be valued using labor-rate fields, but **payroll export / payroll-source integration** is still pending.
- Job profitability now includes labor plus financial events, but **material receipt / issue costs are not yet fully auto-fed into job profitability**.
- Repeating service work now tracks sessions, but **service-agreement billing cycles, snowfall triggers, and recurring invoice generation** still need completion.
- Ontario tax guardrails are stronger, but **full posting rules for AR/AP tax breakdowns, CRA-style reporting support, and closing-period controls** remain open.
> Synchronized for the 2026-04-16 accounting-profitability and job-financial-rollup pass.

## 2026-04-17 remaining gaps after schema 081
- Contract/application generation now exists as stored printable output, but acceptance/signature workflow is still lightweight and needs stronger signed-state handling.
- Payroll export now generates CSV content, but downstream payroll-provider formatting and journal posting handoff still need a finishing pass.
- Snow-event invoicing candidates and one-click invoice generation now exist, but batch review / posting / seasonal close controls still need tightening.
- Callback and warranty dashboard summaries now exist, but the Admin home cards still need stronger prominence and action routing.
- Agreement profitability now exists, but estimate-to-agreement-to-job conversion rules still need more guardrails for custom project and hybrid recurring work.

## 2026-04-19 employee time clock and attendance pass

- Added DB-backed `site_activity_events`, `v_site_activity_recent`, and `v_site_activity_summary` so Admin can review durable activity for staff creation/updates, new jobs, equipment changes, agreements, payroll exports, contracts, and related operational changes.
- Admin now loads and renders a Recent Site Activity table directly from the backend instead of relying only on login traces or per-screen notices.
- `admin-manage`, `jobs-manage`, and `account-maintenance` now record key activity events while still failing safely if the audit trail insert itself has a problem.
- Current schema target is now 082.


### Remaining activity-trace gaps after 082

- Site activity currently focuses on high-value create/update events and login traces; it does not yet capture every approval, posting, or file upload path.
- Admin can review recent activity, but there is not yet a full advanced filter/export workflow for date windows, actor, severity, or entity type.
- Field/mobile-side activity still needs tighter linkage so crews can see the same audit trail context without using the Admin shell.


## 083 Employee site time clock pass
- Added employee site/job sign-in, unpaid break, resume, and sign-out flow tied to job sessions and payroll-linked crew-hour rows.
- Added admin-visible employee time entry records and recent attendance summary data.
- Added site activity audit coverage for clock in, break start, break end, and clock out.
- Next direction: supervisor approval for employee clock exceptions, geofence/photo proof on arrival, payroll export file generation, and contract/estimate conversion polish.


## 084 follow-up gaps
- Geofence capture is stored, but radius/rule enforcement against a site boundary is still pending.
- Photo-note support exists on clock in/out, but actual image upload and storage for attendance evidence is still pending.
- Payroll export file generation exists, but provider-specific layouts and final posting handoff still need completion.
- Agreement execution candidates are now staged, but automatic scheduler-driven session/invoice creation is still pending.


## 085 Attendance / Geofence / Scheduler / Signed-Contract Invoice Pass
- Added attendance photo upload/storage for clock-in and clock-out.
- Added geofence radius evaluation against site coordinates during clock-in/out.
- Added service execution scheduler runs and signed-contract invoice candidates.
- Added provider-specific payroll export layouts.
- Added signed-contract-to-invoice generation support.
