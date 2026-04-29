## 2026-04-25 management workflow reminders, subscriptions, and JSA linkage pass
- Added migration `sql/092_management_workflows_and_subscriptions.sql`.
- Added reminder/escalation fields for corrective actions, worker self-service training acknowledgements, SDS context prompts, report subscriptions, site/supervisor scorecards, overdue alerts, and equipment-specific JSA/hazard linkage.
- Extended reporting so management views now surface due subscriptions, overdue actions, and scorecards instead of only raw history.

## 2026-04-23 scheduler duplicate-dispatch guard and repo hygiene pass
- Updated the committed scheduler Edge Function so successful scheduled runs recalculate and store `next_run_at` instead of leaving it null. This prevents the cron dispatcher from repeatedly re-firing the same enabled scheduler row every minute after a successful run.
- Hardened the SQL dispatcher in both `sql/088_scheduler_cron_media_review_payroll_close_receipts.sql` and `sql/000_full_schema_reference.sql` so rows already queued in the last 10 minutes are skipped. This gives the system a simple duplicate-dispatch guard while preserving the portable Vault/fallback secret flow.
- Removed the stray `sql/000_full_schema_reference.fixed.sql` helper copy again; the canonical schema reference is `sql/000_full_schema_reference.sql`.
- Bumped public cache/version strings and the service-worker cache name so Admin users receive the updated scheduler and workflow code.

<!-- Reviewed during 2026-04-22 workflow guardrail, portable scheduler sync, and repo-alignment pass. -->
<!-- Reviewed during 2026-04-21 scheduler Vault sync, evidence review, signed-contract kickoff, and payroll-close repo alignment pass. -->
<!-- Reviewed during schema 086 HSE ops performance and site-activity rollup pass on 2026-04-20. -->
## 2026-04-22 workflow guardrail and repo-alignment pass
- Tightened Admin evidence review so rejected and follow-up decisions now require an operator note before the action is saved.
- Tightened payroll delivery and close actions so a delivery reference is required before delivery/confirmation and a close signoff note is required before payroll close.
- Improved signed-contract kickoff feedback so the Admin summary now tells the operator whether the job, work order, and first session were created new or linked to existing records.
- Removed the stray `sql/000_full_schema_reference.fixed.sql` helper copy again so the repo keeps one canonical full schema file.
- Refreshed schema headers, deployment/testing notes, roadmap, issues/gaps, and handoff docs to match the current portable scheduler path and the stricter workflow guardrails.

## 2026-04-17 contract conversion, payroll export generation, callback dashboard, and snow invoice automation pass
- Synced the repo to the live scheduler deployment fix by updating the cron dispatcher to prefer Vault when available while cleanly falling back to `current_setting('app.settings.service_execution_scheduler_secret', true)` on environments where the Vault extension is unavailable.
- Added canonical Edge Function config for `service-execution-scheduler-run` with `verify_jwt = false` so repo deploys match the live environment.
- Refreshed the full schema reference and schema 088 so scheduler status, signed-contract kickoff, and payroll-close summary views preserve stable column order during `create or replace view` updates.
- Removed the stray `sql/000_full_schema_reference.fixed.sql` helper copy again so the repo keeps one canonical full schema file.

- Added migration `sql/083_employee_time_clock_and_break_tracking.sql`.
- Added estimate-to-agreement conversion candidates, service contract / application document storage, payroll export file generation support, agreement profitability summaries, snow-event invoice candidates, and callback / warranty dashboard summaries.
- Extended Admin backbone flows so estimates can convert to agreements, agreements can generate printable contracts, payroll runs can generate CSV exports, and snow events can generate draft invoices.
- Repaired and hardened the admin management flow so the new contract, agreement, payroll, and snow-invoice actions are routed through DB-backed records instead of remaining note-only workflow ideas.

## 2026-04-17 recurring agreements, payroll review, asset history, and account tracking pass
- Added migration `sql/080_service_agreements_assets_payroll_and_login_tracking.sql`.
- Added recurring service agreements, snow-event trigger logs, change orders, customer assets, customer-asset service history links, warranty/callback events, payroll export runs, login-event auditing, job material auto-cost rollups, and route profitability summaries.
- Extended Admin directory/manage/UI so the new operations/accounting entities can be loaded and managed from the backbone shell, and staff records now show last login plus login-event count.
- Extended account maintenance/auth flow to record successful login events and update `profiles.last_login_at` for admin visibility.

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

## 2026-04-11 - Admin focus buttons, HSE action items, and monitor thresholds
- Fixed inactive Admin hub buttons for Linked HSE Packets and Analytics / Traffic Monitor.
- Added migration `sql/071_admin_focus_hse_action_items_and_monitor_summaries.sql`.
- Added `v_hse_packet_action_items`, `v_app_traffic_daily_summary`, and `v_monitor_threshold_alerts`.
- Extended admin directory/selectors/UI state so summary/threshold rows load into the Admin shell.
- Added active styling for Admin hub focus cards and better HSE/analytics insight cards.

> Last synchronized: April 11, 2026 (admin focus buttons, HSE action-item summaries, and monitor threshold pass)

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


> Last synchronized: April 11, 2026 (admin focus buttons, HSE action-item summaries, and monitor threshold pass)

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


Last synchronized: April 11, 2026 (admin focus buttons, HSE action-item summaries, and monitor threshold pass)


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

## 2026-04-11 HSE operations hub and admin section-button pass
- Added a separate **HSE Operations** screen outside the long Admin page so safety workflows, OSHA-oriented reminders, and linked-packet shortcuts can be reached more quickly on desktop and mobile.
- Split the Admin experience into section buttons so people/access, jobs/operations, safety/monitoring, accounting, and messaging/diagnostics can be opened without one long scroll.
- Added migration `sql/072_hse_hub_and_accounting_review_summaries.sql` plus summary views for HSE follow-up and accounting review pressure.
- Corrected Admin selector/view alignment for traffic daily summary and HSE action-item ordering so the newer safety and monitoring shortcuts stay usable.
- Continued the DB-first direction while keeping HSE standalone-capable and easier to connect to jobs, work orders, routes, equipment, dispatches, sites, and subcontract work.

- April 14, 2026: Added admin-manage compatibility fallback so Create Staff User no longer hangs when the direct Edge Function path stalls or returns non-JSON.

## 2026-04-14 profile route recovery, landscaping workflow tie-in, and Ontario accounting guidance pass
- Hardened the `#me` profile route by fixing uninitialized profile/crew async load counters, re-binding profile layout on route show, and adding a visible fallback shell in `index.html` so the route no longer appears blank while profile modules initialize.
- Made router scroll behavior safer by replacing the non-standard `instant` scroll option with a guarded `auto` fallback.
- Added an Ontario accounting helper note in the Admin accounting stub and auto-filled a 13% HST helper amount from subtotal when the tax field is blank.
- Added `docs/ONTARIO_ACCOUNTING_AND_TAX_GUARDRAILS.md` and refreshed the roadmap/gaps/docs around the landscaping/client/job/employee/financial convergence direction.
- No new SQL migration was added in this pass; schema reference files were reviewed and remain aligned through migration 075.

## 2026-04-15 – Job pricing, discount logic, and profitability pass
- Added job-level cost-to-us, charge-to-client, pricing method, markup, discount, duration, open-end scheduling, delay, repair-cost, and actual profit fields.
- Added SQL migration `076_job_pricing_profitability_and_schedule_logic.sql`.
- Updated jobs UI and jobs-manage so pricing and schedule logic save together with crew/equipment planning.
- Refreshed the roadmap, gaps, project state, and schema snapshot to reflect the landscaping-first commercial workflow.

## 2026-04-15 - Admin pricing/tax backbone finish
- Added Admin backbone support for Tax Codes, Business Tax Settings, and Service Pricing Templates.
- Fixed a broken duplicate tail appended after the real end of `supabase/functions/admin-manage/index.ts`.
- Wired Admin UI loading for DB-backed Ontario tax codes/settings and reusable service pricing templates so these records can be managed from the app instead of living only in schema/backend code.



## 2026-04-15 - Job session tracking, crew hours, and reassignment workflow
- Added migration `sql/078_job_sessions_reassignments_and_admin_sorting.sql`.
- Added DB-backed job sessions, crew-hour logs, and job reassignment events so recurring services and one-time jobs can be tracked per visit instead of only at the parent job level.
- Jobs now carry `client_reference`, `service_contract_reference`, `billing_transaction_number`, and `invoice_number` for future accounting and invoicing links.
- Jobs screen now has a sortable saved-jobs table with row-click load/edit behavior plus quick actions for session tracking, crew-hour logging, and emergency reassignment.
- `jobs-directory` now returns job sessions, crew hours, and reassignment data to the UI.

## 2026-04-16 accounting profitability and job-financial rollup pass
- Added migration `sql/079_job_financial_rollups_and_profit_review.sql`.
- Added DB-backed `job_financial_events` so field and office teams can record material, repair, delay, fuel, subcontract, disposal, travel, permit, and revenue-adjustment events against a job or session.
- Added profile labor-rate fields (`hourly_cost_rate`, `overtime_cost_rate`, `hourly_bill_rate`, `overtime_bill_rate`, `payroll_burden_percent`) so crew hours can begin feeding profitability and invoice review instead of living only as time logs.
- Added `v_job_labor_rollups`, `v_job_financial_event_rollups`, `v_job_financial_rollups`, and refreshed `v_jobs_directory` / `v_accounting_review_summary` so delayed jobs, unsigned sessions, loss-making jobs, and uninvoiced completed work are easier to review.
- Extended Jobs/Admin flows so staff pay-basis fields and job financial-event records can be managed through the app shell.
> Synchronized for the 2026-04-16 accounting-profitability and job-financial-rollup pass.


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


## 2026-04-19 — supervisor attendance review and execution candidates
- Added schema 084 for attendance exception review, geolocation/photo-note time-clock fields, operations dashboard summary, and recurring agreement execution candidates.
- Added admin-manage actions for estimate conversion, printable contract generation, snow invoice generation, payroll export generation, and time-entry review.

## 085 - attendance photos, geofence rules, scheduler, payroll layouts, signed-contract invoices
- Added migration `sql/085_attendance_photo_geofence_scheduler_and_signed_contract_invoice.sql`.
- Added attendance photo upload/storage flow for clock-in and clock-out.
- Added geofence radius evaluation using site coordinates.
- Added provider-specific payroll export layouts.
- Added signed-contract invoice generation support.
- Added service execution scheduler runs and scheduler candidate views.


## 2026-04-20 HSE ops performance, site-activity rollups, and repo hygiene pass
- Added migration `sql/086_hseops_performance_and_site_activity_rollups.sql`.
- Moved the HSE Operations page to a lighter `admin-selectors` scope so the hub no longer asks the server for the full Admin selector payload every time it opens.
- Added DB-backed site-activity rollup views for event-type and entity-type summaries so Admin can keep watching new jobs, staff adds, equipment adds, and attention events without reading only raw rows.
- Tightened the HSE Operations rendering path with delegated click handling, render batching, and stale-load avoidance to reduce avoidable layout work when the route opens repeatedly.
- Renamed the stray `test_write.txt` file to `test_write_OLD.txt` as part of repo cleanup.

## 2026-04-17 contract conversion, payroll export, callback dashboard, and snow-invoice automation pass

## 2026-04-20 evidence review, scheduler settings, payroll-close, and signed-contract kickoff pass
- Added migration `sql/087_evidence_review_scheduler_settings_and_signed_contract_kickoff.sql`.
- Added Admin evidence-review lanes for attendance photos and HSE proof items, plus activity-rollup drill-through into filtered Admin records.
- Added scheduler settings/status groundwork for service execution automation and a signed-contract-to-live-job kickoff path.
- Added payroll close review summary visibility so export delivery can be checked against attendance exceptions and unexported labor.
- Reduced Admin selector overfetch by switching backbone selector loading to the new `admin_core` scope.


## 2026-04-21 — Scheduler cron, evidence review, kickoff, and payroll close pass

- Added schema pass `088_scheduler_cron_media_review_payroll_close_receipts.sql`.
- Added cron-ready service execution scheduler dispatch plumbing using scheduler settings, invoke URLs, pg_net, and pg_cron.
- Added `media_review_actions` plus richer attendance/HSE evidence review views with review status, notes, reviewer, and needs-review flags.
- Extended signed-contract kickoff so a signed contract can create/link a live job, create a work order, and create the first planned session.
- Extended payroll export runs with delivery confirmation, close-signoff fields, and summary rollups after export generation.
- Normalized payroll export provider handling so QuickBooks Time / SimplePay / ADP CSV selections map correctly into generated layouts.
- Refined Admin evidence review UI, scheduler controls, and payroll export workflow states.
- Bumped frontend cache/version strings and re-ran the repo smoke check.

## 2026-04-22 portable scheduler fallback, evidence review polish, contract kickoff messaging, payroll close sequencing, and image-score documentation pass
- Reworked schema 088 and the canonical full schema so scheduler dispatch prefers Vault when available but no longer fails on environments where the `vault` extension is unavailable.
- Removed the unsupported `create extension if not exists vault;` requirement from canonical schema files and restored a safe `app.settings.*` fallback path.
- Tightened payroll export workflow sequencing so Admin now moves through delivered -> confirmed -> closed instead of jumping directly to confirmed/closed.
- Improved Admin prompts and summaries for evidence review notes, signed-contract kickoff results, and payroll delivery/close notes.
- Added explicit documentation that image rating is a rule-based completeness score, not an AI quality grade, and recorded the current weighting plus possible future merchandising signals.

## 2026-04-24 auth wall, historical reports, and OSHA reporting pass
- Fixed the public auth wall so logged-out users no longer see the live Toolbox Talk, PPE Check, First Aid Kit, Site Inspection, or Emergency Drill screens underneath the sign-in interface.
- Added a supervisor/admin **Historical Reports** screen with export-ready HSE form history, site/form rollups, and cross-workflow history covering submissions, HSE packet events, evidence review, scheduler runs, payroll exports, and signed contracts.
- Added migration `sql/089_historical_reporting_and_auth_wall_support.sql` and synced the full schema reference so reporting stays DB-backed instead of drifting into browser-only JSON snapshots.
- Continued the OSHA-facing direction by keeping the five field forms first-class while making their historical retrieval and review more usable for office and supervisor follow-up.
- Next strongest follow-up: add incident / near-miss reporting, saved report presets, richer trend charts, and deeper drill-down exports by site, worker, route, and work-order context.

## 2026-04-24 incident reporting, DB-backed report presets, and richer HSE analytics pass
- Added a new **Incident / Near Miss** field form so workers and supervisors can capture injuries, close calls, damage, witness names, immediate actions, and corrective-action ownership without waiting for office follow-up.
- Added migration `sql/090_incident_reporting_saved_report_presets_and_trends.sql`.
- Added DB-backed reporting presets (`report_presets`) so supervisors and admins can reuse saved report filters without depending on local browser storage.
- Expanded reporting with DB-backed views for incident history, monthly trends, worker rollups, and site/job/route context rollups.
- Reworked the historical reports screen to use the richer DB-backed datasets and added incident CSV export.
- Added a dedicated incident quick link in the public nav, HSE Ops, and Admin hub so the OSHA-facing workflows stay easy to reach on mobile and desktop.
- Next strongest follow-up: training history + certification expiry, SDS acknowledgement tracking, OSHA 300/300A/301-oriented recordkeeping helpers, and corrective-action task assignment from incident rows.

- 2026-04-24: Added incident / near-miss field form, DB-backed report presets, incident/trend/worker/context reporting views, uploadImagesForSubmission helper, and reporting/admin/HSE Ops route updates.

## 2026-04-25 corrective actions + training pass
- Synced the repo to include first-class corrective-action tasks, training / certification expiry tracking, SDS acknowledgement history, and management-focused reporting.
- See `docs/CORRECTIVE_ACTIONS_AND_TRAINING.md` and the new `sql/091_corrective_actions_training_and_sds_tracking.sql` migration.

## Latest pass note (2026-04-25d)
- Synced for scheduled report delivery, worker self-service training/SDS acknowledgement, and Jobs commercial/accounting foundation planning.

## 2026-04-26 pass note

This pass moves the project into the Jobs commercial/accounting phase.
It adds the 094 Jobs commercial workflow foundation, updates the repo status toward estimate/work-order/completion/accounting readiness, and keeps the schema/docs aligned for the next phase.

---

## Pass 095 sync note

Synced through the Jobs quote / approval / release / accounting-candidate pass.
This pass adds client-ready quote package rendering, approval thresholds, release controls, completion package drilldown, invoice/journal candidates, AR/AP coordination, and business-entity / tax-profile mapping for corporation and LLC-style filing handoff.



## Pass 096 notes

This pass adds branded quote output, automatic threshold evaluation, closeout evidence linkage, invoice/journal posting-rule structures, accountant handoff exports, and profitability/variance scorecards for the Jobs commercial workflow.
