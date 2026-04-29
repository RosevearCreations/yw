## 2026-04-23 deployment note
- After deploying the scheduler Edge Function, verify that completed runs update `next_run_at`. If `next_run_at` remains null, cron may keep dispatching.
- The SQL dispatcher now skips rows with `last_dispatch_status = queued` and a dispatch time inside the last 10 minutes as an extra safety guard.

<!-- Reviewed during 2026-04-22 workflow guardrail, portable scheduler sync, and repo-alignment pass. -->
<!-- Reviewed during 2026-04-21 scheduler Vault sync, evidence review, signed-contract kickoff, and payroll-close repo alignment pass. -->
<!-- Reviewed during schema 086 HSE ops performance and site-activity rollup pass on 2026-04-20. -->
<!-- Reviewed during schema 080 recurring agreements / payroll / asset history / login tracking pass on 2026-04-17. -->
## 2026-04-13 staff admin save verification pass
### Scheduler deployment alignment (2026-04-21)
1. Deploy `service-execution-scheduler-run`.
2. Ensure `verify_jwt = false` remains committed for that function.
3. Store the same shared secret in both places:
   - Edge Function secret: `SERVICE_EXECUTION_SCHEDULER_SECRET`
   - Supabase Vault secret name: `service_execution_scheduler_secret`
4. Set `service_execution_scheduler_settings.invoke_url` to the deployed function URL.
5. Run `select public.dispatch_due_service_execution_scheduler_runs();` once to verify the database dispatcher, Vault secret, and Edge Function all work together.
6. Confirm `service_execution_scheduler_settings.last_dispatch_status` and `service_execution_scheduler_runs` show successful activity before relying on cron alone.

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

## 2026-04-11 deployment note
- Run `sql/071_admin_focus_hse_action_items_and_monitor_summaries.sql` after the corrected 070 migration.
- Hard refresh Admin after deploy so the new hub-card click handling, active styling, and summary-driven insights are loaded.

> Last synchronized: April 11, 2026 (admin focus buttons, HSE action-item summaries, and monitor threshold pass)

## 2026-04-11 deployment addition
- Run `sql/069_hse_osha_interfaces_weather_chemical_traffic_signoff.sql` after the current live pass before testing the new packet-event workflow.

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

## Deployment note for this pass
After deploying this pass, validate migration 063 before trusting Admin totals:
- create/update estimate lines and confirm estimate header rollups change
- create/update work-order lines and confirm work-order rollups change
- add receipt lines against a work order and confirm received-cost visibility changes
- post AR/AP payments and confirm amount-paid / balance-due update
- toggle HSE packet completion fields and confirm status/progress transitions

- Added DB-first workflow logic so estimate, work-order, and material-receipt header totals can roll up from their line records instead of depending on manual entry.
- Added receivables/payables payment-application logic so invoices and bills can track paid amounts, remaining balance, and partial/paid status from posted payments.
- Added receiving-to-costing linkage so material receipt lines can feed received quantity / received cost visibility back into work-order execution.
- Extended linked HSE packets toward real progress and closeout handling with checklist-style completion fields, derived progress, and clearer Admin-side visibility.


## 2026-04-08 landscaping/construction/mobile/admin-ui pathway documentation pass
- Refreshed the Markdown set to move the product direction from schema-only groundwork into the next implementation phase: admin UI managers for estimates/work orders, materials/units, routes/service areas, subcontract dispatch, and AR/AP + chart of accounts.
- Added a clearer rationale for keeping HSE as a first-class standalone module that can later link to jobs, sites, and dispatches for landscaping, project, and subcontract work.
- Updated the docs to emphasize mobile-first field use, desktop-strong admin depth, DB-first shared data, and local SEO / one-H1 discipline on every public build pass.

> Last synchronized: April 8, 2026. Reviewed during the estimates/work-orders/routes/materials/subcontract/general-ledger foundation and documentation synchronization pass.

# Deployment Guide

## April 10, 2026 deployment note
- Apply `sql/064_receipt_rollups_work_order_operational_status_and_posted_amounts.sql` after 063.
- Deploy the updated `admin-selectors` and `admin-manage` edge functions together with the frontend so the new rollup fields and smart defaults stay aligned.
- Run the repo smoke check after deploy and verify the new migration file exists in the deployed repo snapshot.

Last synchronized: April 11, 2026 (admin focus buttons, HSE action-item summaries, and monitor threshold pass)

## Deployment principles

Deployments should now be treated as operations-critical because session integrity and role trust are central to the app.

## Always deploy together when changed
- frontend shell/assets
- Supabase Edge Functions
- SQL migrations
- Markdown/schema notes for the same pass

## High-risk deployment areas
- auth/session logic
- role evaluation
- logout flow
- review-list and other CORS-sensitive functions
- admin selectors / protected directory functions

## Required post-deploy checks
1. confirm the new shell version is loaded
2. sign in as Admin
3. move through multiple screens
4. confirm the header identity stays correct
5. confirm Settings still shows the same account data
6. confirm logout works every time
7. confirm Logbook/review-list works without CORS failure
8. confirm Admin dropdowns, staff, equipment, and jobs still load

## Current deployment focus
- keep public pages SEO-clean with one H1 each
- verify the newest shell version after each deploy
- deploy schema changes before the admin screens that depend on them
- treat admin managers for estimates, materials, routes, dispatch, and AR/AP as the next major rollout wave

## 2026-04-10 crew assignment, recurring jobs, and field activity pass
- Job creation now has a clearer ownership path: a crew can be assigned at the same time as an explicit supervisor so responsibility is visible from the start.
- Jobs now support standalone or recurring scheduling fields, with recurrence summary/rule storage in the database instead of leaving schedule logic only in draft UI state.
- Job comments now have a DB-backed activity trail with optional photo attachments and special-instruction flags so crews and supervisors can review site notes, uploaded images, and field changes in one place.
- This pass continues the DB-first direction for shared operational data and reduces duplication risk compared with keeping crew/job packet details only in local JSON or loosely coupled browser state.
- After deploy, verify the upload-job-comment-attachment function is published and the `submission-images` bucket allows the expected signed upload/read flow.


## Deployment note for the 066 pass
- Run `sql/066_journal_posting_controls_and_material_issue_usage.sql` after 065.
- After deploy, create a draft journal batch, add offsetting entries, confirm the batch becomes balanced, then post it from Admin.
- Create a material issue tied to a work order, add issue lines, and confirm the issue header totals and variance update.

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


## This pass requires
- run `sql/076_job_pricing_profitability_and_schedule_logic.sql` before deploying the updated jobs UI and jobs-manage function
- after deploy, hard refresh the Jobs page to load the new pricing and duration fields
> Synchronized for the 2026-04-16 accounting-profitability and job-financial-rollup pass.



## 2026-04-21 deployment note

After deploying this build, apply schema 088 and verify environment configuration for the service execution scheduler secret plus the per-setting invoke URL. Then test the full Admin flow for evidence review, signed-contract kickoff, and payroll export delivery/close actions. Rejected/follow-up evidence should require notes, delivered payroll exports should keep a delivery reference, and payroll close should require a signoff note.

### 2026-04-22 scheduler environment note
Use Vault on hosted Supabase when available. If the target environment does not provide the `vault` extension, keep the same secret in the Edge Function and set the fallback runtime config `app.settings.service_execution_scheduler_secret` for dispatcher testing or deployment-specific runtime wiring.

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

- Apply `sql/090_incident_reporting_saved_report_presets_and_trends.sql` after `089` so incident history, report presets, and richer reporting views are available before the next UI deploy.

## 2026-04-25 corrective actions + training pass
- Synced the repo to include first-class corrective-action tasks, training / certification expiry tracking, SDS acknowledgement history, and management-focused reporting.
- See `docs/CORRECTIVE_ACTIONS_AND_TRAINING.md` and the new `sql/091_corrective_actions_training_and_sds_tracking.sql` migration.


After applying migration 092, reload the reporting/admin data scope so new views (`v_report_subscription_directory`, `v_overdue_action_alerts`, `v_site_safety_scorecards`, `v_supervisor_scorecards`, `v_equipment_jsa_hazard_link_directory`) are available to the frontend.

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
