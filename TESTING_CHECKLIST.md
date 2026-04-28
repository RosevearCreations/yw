## 2026-04-23 required test additions
- Run the scheduler manually and verify `service_execution_scheduler_settings.next_run_at` is recalculated after the Edge Function completes.
- Let cron run for at least 10 minutes and confirm it does not create duplicate scheduler runs for the same due window.
- Confirm rejected/follow-up evidence requires notes.
- Confirm payroll delivered requires a delivery reference, confirmed requires an existing delivered state/reference, and closed requires a close signoff note.

<!-- Reviewed during 2026-04-22 workflow guardrail, portable scheduler sync, and repo-alignment pass. -->
<!-- Reviewed during 2026-04-21 scheduler Vault sync, evidence review, signed-contract kickoff, and payroll-close repo alignment pass. -->
<!-- Reviewed during schema 086 HSE ops performance and site-activity rollup pass on 2026-04-20. -->
<!-- Reviewed during schema 080 recurring agreements / payroll / asset history / login tracking pass on 2026-04-17. -->
## 2026-04-13 staff admin save verification pass
### 2026-04-21 operational workflow checks
- Run `select public.dispatch_due_service_execution_scheduler_runs();` and verify a fresh scheduler run plus updated dispatch status.
- In Admin evidence review, approve one attendance photo, reject one attendance/HSE row, and mark one item follow-up; confirm notes/reviewer/timestamps refresh immediately.
- Confirm rejected/follow-up evidence cannot be saved without a note.
- Confirm payroll delivery cannot be marked delivered without a delivery reference and cannot be closed without a signoff note.
- From a signed contract row, run kickoff and verify a job, a work order, and the first planned session are created/linked as expected.
- Generate a payroll export, mark it delivered/confirmed, then close it and verify delivery/close timestamps plus actor fields populate.

- Added visible inline create/save/reset/block/delete confirmations in the Staff Directory screen so staff actions no longer fail silently from the operator’s point of view.
- Added stronger front-end email and password validation plus busy-state feedback for staff actions.
- Updated `supabase/functions/admin-manage/index.ts` so staff-detail saves now persist email changes instead of leaving the visible Email field unsaved.
- No new SQL migration was added in this pass; schema files were reviewed and remain on the 074 baseline.

> Last synchronized: April 14, 2026 (landscaping job workflow, crew planning, and schema 075)

## 2026-04-12 added regression targets
- Verify HSE packet forms show the new machinery/tool, lifting/posture, weather/heat, and chemical/public cue fields in Admin.
- Verify HSE event forms save hazard category, cones/barriers, SDS, lockout, lifting, and hydration-related details without breaking older rows.
- Verify Site Inspection hazard rows now carry category-focused presets and preserve offline/outbox behavior.
- Verify HSE Ops summary cards surface machinery/lifting and chemical/public open counts alongside the existing monitor shortcuts.
- Recheck the single-H1 rule and public metadata after the Southern Ontario wording refresh.

> Last synchronized: April 12, 2026 (HSE control-cue and inspection-focus checks added)

> Last synchronized: April 12, 2026 (HSE shortcut and monitor drill-through checks added)

## Add to next live verification
- Verify the **Linked HSE Packets** Admin hub card focuses the backbone manager on linked packets and selects a live packet.
- Verify the **Analytics / Traffic Monitor** Admin hub card focuses the backbone manager on monitoring data and shows current threshold insight cards.
- Run migration `071_admin_focus_hse_action_items_and_monitor_summaries.sql`.
- Confirm `v_hse_packet_action_items`, `v_app_traffic_daily_summary`, and `v_monitor_threshold_alerts` return rows without renaming existing view columns.

> Last synchronized: April 11, 2026 (admin focus buttons, HSE action-item summaries, and monitor threshold pass)

## Add these tests for the 069 pass
- Create a standalone HSE packet and an unscheduled-project packet; confirm packet scope and status behave correctly.
- Add weather, heat, chemical, traffic, signoff, closeout, and reopen events; confirm packet progress rolls up correctly.
- Confirm field-signoff timestamps and signer fields populate when signoff is completed.
- Force a failed live admin load and confirm the cached admin fallback view appears with a clear warning.

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

## Add these tests for the 063 pass
- Estimate line create/update/delete changes estimate subtotal, total, cost, and margin.
- Work-order line create/update/delete changes work-order subtotal, total, cost, and margin.
- Material receipt line create/update/delete changes receipt total and linked work-order received-cost totals.
- AR payment create/update/delete changes invoice amount-paid, balance-due, and partial/paid status.
- AP payment create/update/delete changes bill amount-paid, balance-due, and partial/paid status.
- Linked HSE packet checklist toggles change derived progress and ready-for-closeout / closed state.

- Added DB-first workflow logic so estimate, work-order, and material-receipt header totals can roll up from their line records instead of depending on manual entry.
- Added receivables/payables payment-application logic so invoices and bills can track paid amounts, remaining balance, and partial/paid status from posted payments.
- Added receiving-to-costing linkage so material receipt lines can feed received quantity / received cost visibility back into work-order execution.
- Extended linked HSE packets toward real progress and closeout handling with checklist-style completion fields, derived progress, and clearer Admin-side visibility.


## 2026-04-08 landscaping/construction/mobile/admin-ui pathway documentation pass
- Refreshed the Markdown set to move the product direction from schema-only groundwork into the next implementation phase: admin UI managers for estimates/work orders, materials/units, routes/service areas, subcontract dispatch, and AR/AP + chart of accounts.
- Added a clearer rationale for keeping HSE as a first-class standalone module that can later link to jobs, sites, and dispatches for landscaping, project, and subcontract work.
- Updated the docs to emphasize mobile-first field use, desktop-strong admin depth, DB-first shared data, and local SEO / one-H1 discipline on every public build pass.

> Last synchronized: April 8, 2026. Reviewed during the estimates/work-orders/routes/materials/subcontract/general-ledger foundation and documentation synchronization pass.

# Testing Checklist

## April 10, 2026 testing expansion
- Create a receipt with mixed allocated and unallocated lines and confirm Admin shows the split correctly.
- Confirm work orders show receipt count, received material cost, and unallocated receipt cost after receipt edits.
- Confirm AR/AP records show posted amount, open amount, and posted percent after payment edits.
- Confirm smart defaults populate from selected materials, equipment, work-order lines, invoices, bills, and linked work orders/dispatches.

## April 9, 2026 testing expansion
- Add admin tests for route stops, estimate/work-order lines, AR/AP payment posting, material receiving, and linked HSE packet CRUD.
- Add phone-sized viewport checks for all new admin-manager forms.


Last synchronized: April 11, 2026 (admin focus buttons, HSE action-item summaries, and monitor threshold pass)

## Session integrity tests
- sign in as Admin
- navigate across random screens
- confirm header identity remains Admin
- confirm Settings remains the same user
- sign out repeatedly from different screens
- confirm logout always works
- confirm no partial profile from another user appears

## Role tests
- Admin access to staff/dropdowns/equipment/jobs
- Supervisor scoped access
- Employee limited access
- legacy worker records still resolve safely

## HSE tests
- toolbox
- PPE
- first aid
- inspection
- emergency drill
- logbook/review-list
- standalone usage without full operations record

## Admin backbone tests
- staff create/edit/block/reset
- dropdown create/edit/delete
- equipment listing load/edit
- jobs/work orders load/edit
- assignments create/edit/delete

## Mobile tests
- phone-size layout
- touch target sizing
- save feedback visibility
- form scrolling
- empty states and validation clarity

## Next-wave testing priorities
- estimate/work-order create/edit/approve flows
- materials + unit CRUD and dropdown population
- route/service-area creation and stop ordering
- subcontract dispatch creation, operator/equipment pairing, and billing basis
- AR/AP record creation and chart-of-accounts mapping
- standalone HSE record creation and later linking into work orders/dispatches
- mobile field-use validation on phone-sized screens

## 2026-04-10 crew assignment, recurring jobs, and field activity pass
- Job creation now has a clearer ownership path: a crew can be assigned at the same time as an explicit supervisor so responsibility is visible from the start.
- Jobs now support standalone or recurring scheduling fields, with recurrence summary/rule storage in the database instead of leaving schedule logic only in draft UI state.
- Job comments now have a DB-backed activity trail with optional photo attachments and special-instruction flags so crews and supervisors can review site notes, uploaded images, and field changes in one place.
- This pass continues the DB-first direction for shared operational data and reduces duplication risk compared with keeping crew/job packet details only in local JSON or loosely coupled browser state.
- New testing priority: verify crew assignment + supervisor ownership on create/edit, comment/photo upload/delete flows, and recurring schedule persistence across reloads.


## Add these tests for the 066 pass
- Journal entry create/update/delete changes batch line count, debit total, credit total, and balanced state.
- Posting a balanced journal batch succeeds and an unbalanced batch is blocked with a clear error.
- Material issue line create/update/delete changes issue quantity total, issue total, and variance amount.
- Material issue lines inherit defaults correctly from selected materials and work-order lines.

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


## Add to manual regression
- create a one-time job with manual price and verify estimated profit/margin persist
- create a recurring job with markup % and confirm the server recalculates quoted charge
- create an open-end job and confirm reservation end stays blank
- mark a job delayed and verify delay cost and notes persist
> Synchronized for the 2026-04-16 accounting-profitability and job-financial-rollup pass.


## 2026-04-19 employee time clock and attendance pass

- Added DB-backed `site_activity_events`, `v_site_activity_recent`, and `v_site_activity_summary` so Admin can review durable activity for staff creation/updates, new jobs, equipment changes, agreements, payroll exports, contracts, and related operational changes.
- Admin now loads and renders a Recent Site Activity table directly from the backend instead of relying only on login traces or per-screen notices.
- `admin-manage`, `jobs-manage`, and `account-maintenance` now record key activity events while still failing safely if the audit trail insert itself has a problem.
- Current schema target is now 082.


## 2026-04-21 added checks

- Verify the single public H1 remains intact on the exposed page.
- Verify scheduler setting save/run-now flow and next-run updates.
- Verify evidence approve / reject / follow-up actions persist and refresh the review tables.
- Verify signed contract kickoff creates or links a job, creates a work order, and creates the first session.
- Verify payroll export can be generated, confirmed delivered, and closed.

### 2026-04-22 regression targets
- Apply schema 088 on both Vault-capable and non-Vault environments and verify the dispatcher function compiles cleanly in both cases.
- In Admin evidence review, record approve/reject/follow-up notes and confirm the review note appears immediately after reload.
- From a signed contract, run kickoff and confirm the Admin summary reports the linked job, work order, and first planned session date.
- For payroll export runs, verify the UI now requires delivered, then confirmed, then closed in that order.
- Verify the new image-score documentation matches the intended completeness-score weighting before future merchandising score work begins.

## 2026-04-24 auth wall, historical reports, and OSHA reporting pass
- Fixed the public auth wall so logged-out users no longer see the live Toolbox Talk, PPE Check, First Aid Kit, Site Inspection, or Emergency Drill screens underneath the sign-in interface.
- Added a supervisor/admin **Historical Reports** screen with export-ready HSE form history, site/form rollups, and cross-workflow history covering submissions, HSE packet events, evidence review, scheduler runs, payroll exports, and signed contracts.
- Added migration `sql/089_historical_reporting_and_auth_wall_support.sql` and synced the full schema reference so reporting stays DB-backed instead of drifting into browser-only JSON snapshots.
- Continued the OSHA-facing direction by keeping the five field forms first-class while making their historical retrieval and review more usable for office and supervisor follow-up.
- Next strongest follow-up: add incident / near-miss reporting, saved report presets, richer trend charts, and deeper drill-down exports by site, worker, route, and work-order context.



## Historical reporting tests
- Verify logged-out users see only the sign-in shell and no live form sections below it.
- Verify the Reports screen loads for supervisor/admin roles and stays hidden for worker-level roles.
- Verify HSE CSV export respects date/site/form filters.
- Verify Workflow CSV export includes payroll export, scheduler run, signed contract, evidence review, and packet-event rows.

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


## Management workflow pass
- Create a corrective action and record reminder + escalation actions.
- Create a self-acknowledged training record and verify verification-pending behavior.
- Create an SDS acknowledgement with job/work-order/route/equipment context.
- Create a report subscription with a due send date and verify it appears in reporting.
- Create an equipment JSA / hazard link and verify queue + alert visibility.

## Latest pass note (2026-04-25d)
- Synced for scheduled report delivery, worker self-service training/SDS acknowledgement, and Jobs commercial/accounting foundation planning.

## 2026-04-26 pass note

This pass moves the project into the Jobs commercial/accounting phase.
It adds the 094 Jobs commercial workflow foundation, updates the repo status toward estimate/work-order/completion/accounting readiness, and keeps the schema/docs aligned for the next phase.

---

## Pass 095 sync note

Synced through the Jobs quote / approval / release / accounting-candidate pass.
This pass adds client-ready quote package rendering, approval thresholds, release controls, completion package drilldown, invoice/journal candidates, AR/AP coordination, and business-entity / tax-profile mapping for corporation and LLC-style filing handoff.

