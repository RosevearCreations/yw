## 2026-04-23 AI context update
- Scheduler truth: successful `service-execution-scheduler-run` executions must write a future `next_run_at`; SQL also suppresses recently queued dispatches for 10 minutes. Do not revert this to a null next-run behavior.

<!-- Reviewed during 2026-04-22 workflow guardrail, portable scheduler sync, and repo-alignment pass. -->
<!-- Reviewed during 2026-04-21 scheduler Vault sync, evidence review, signed-contract kickoff, and payroll-close repo alignment pass. -->
## 2026-04-20 context refresh (schema 087)
- Scheduler runtime is now proven live through Hosted scheduler runtime is proven through Vault-backed dispatch plus the `service-execution-scheduler-run` Edge Function, while canonical SQL now falls back cleanly when Vault is unavailable.
- When editing scheduler files, keep SQL, full schema, function code, function config, deployment guide, testing checklist, roadmap, and new-chat handoff in sync.

- Admin backbone forms now use `admin_core` selector loading to reduce payload size.
- New migration `087_evidence_review_scheduler_settings_and_signed_contract_kickoff.sql` adds scheduler settings/status, evidence review views, signed-contract kickoff candidates, and payroll-close review summaries.
- Admin UI now includes activity-rollup drill-through plus attendance/HSE evidence review tables.
- Signed service contracts can kick off live jobs, not only draft invoices.

<!-- Reviewed during schema 086 HSE ops performance and site-activity rollup pass on 2026-04-20. -->
<!-- Reviewed during schema 080 recurring agreements / payroll / asset history / login tracking pass on 2026-04-17. -->
## 2026-04-17 snapshot
The app now supports recurring service agreements, snow triggers, change orders, customer assets/history, payroll export review, warranty/callback tracking, account login auditing, material-to-job auto-costing, and route profitability summaries. Treat schema 082 as current.

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

## Latest handoff note
- The inactive Admin hub buttons for Linked HSE Packets and Analytics / Traffic Monitor were fixed in the 071 pass.
- Admin now loads HSE packet action items, traffic daily summaries, and monitor threshold alerts.
- Next likely work is drill-through from alert/action summaries into filtered incident/packet views plus more mobile supervisor closeout speed.

> Last synchronized: April 11, 2026 (admin focus buttons, HSE action-item summaries, and monitor threshold pass)

> April 11, 2026 sync: reviewed during the HSE OSHA interface, packet events, and field signoff pass.

## 2026-04-11 journal sync exceptions and upload fallback pass
- Added migration `sql/068_journal_sync_exceptions_and_upload_failure_fallback.sql`.
- Added DB-backed `gl_journal_sync_exceptions` so stale, unbalanced, and missing-entry source batches are visible as first-class review items instead of hidden batch-state guesses.
- Added DB-backed `field_upload_failures` so failed job-comment and equipment-evidence uploads leave an auditable fallback trail for retry/resolution instead of failing silently.
- Extended Admin selectors/directory/manage/UI so sync exceptions and upload failures can be reviewed, resolved, or dismissed from the same backbone shell.
- Tightened job activity upload handling so comments can still save even when attachments fail, with clearer operator feedback and follow-up visibility.

## Immediate priorities for the next pass
- true journal posting and audit controls
- material issue / usage records after receiving
- route-stop execution state and proof capture
- richer HSE closeout evidence, reopen, and attachments

> Last synchronized: April 11, 2026 (admin focus buttons, HSE action-item summaries, and monitor threshold pass)

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

> Last synchronized: April 8, 2026. Reviewed during the estimates/work-orders/routes/materials/subcontract/general-ledger foundation and documentation synchronization pass.

# AI Context

Last synchronized: April 11, 2026 (admin focus buttons, HSE action-item summaries, and monitor threshold pass)

## What this project is now
Treat the product as a landscaping-led field operations platform with integrated HSE capabilities.

## Core business modes
- recurring landscaping operations
- project/construction-style jobs
- subcontract dispatch work
- standalone HSE workflows

## What future passes should prefer
- database-backed shared operational data
- mobile-first field UX
- desktop-strong admin depth
- stable session identity above all other feature work

## Current planning note
When continuing this project, assume the next strongest implementation pass is the admin UI layer on top of the new operations/accounting tables, while keeping HSE standalone-friendly and mobile-first.

## 2026-04-10 crew assignment, recurring jobs, and field activity pass
- Job creation now has a clearer ownership path: a crew can be assigned at the same time as an explicit supervisor so responsibility is visible from the start.
- Jobs now support standalone or recurring scheduling fields, with recurrence summary/rule storage in the database instead of leaving schedule logic only in draft UI state.
- Job comments now have a DB-backed activity trail with optional photo attachments and special-instruction flags so crews and supervisors can review site notes, uploaded images, and field changes in one place.
- This pass continues the DB-first direction for shared operational data and reduces duplication risk compared with keeping crew/job packet details only in local JSON or loosely coupled browser state.
- Future AI passes should preserve the rule that every new job can carry both a crew and a clearly named responsible supervisor.

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

- Reliability note: admin staff create/save uses `js/api.js -> manageAdminEntity()` and now includes a same-origin `/api/auth/admin-manage` fallback for stalled direct function calls.

## 2026-04-14 operational model note
- The work model should now assume three main job patterns: one-time landscaping/project jobs, recurring route/service jobs, and larger custom project/construction/home-modification jobs.
- Crew setup should support a supervisor and optional crew lead, plus reusable member/equipment planning context.
- Equipment planning should prefer reservation windows for repeat work instead of depending only on single start/end dates.

## April 14, 2026 context refresh
- Treat the product direction as a landscaping operations application first, with recurring service, custom project work, subcontract dispatch, HSE, and accounting converging in one shell.
- The `#me` route has just been hardened in the frontend; profile/load regressions should still be watched closely.
- Ontario/CAD accounting rules now have a Markdown guardrail note, but full tax settings still need DB-backed implementation.


## 2026-04-15 context addendum
The app is moving from a generic jobs/equipment tool into a landscaping-focused business system. Jobs now need to behave like commercial records with cost, charge, discount, timing, delay, and repair-loss data, while still supporting one-time work, repeating work, and open-end projects.

## Current implementation note
- Migration `077_service_pricing_templates_and_ontario_tax_codes.sql` is surfaced in both backend and Admin UI.
- Admin backbone now supports `tax_code`, `business_tax_setting`, and `service_pricing_template`.
- `jobs-manage` computes estimated tax/total using DB-backed tax/template defaults.



## Current workflow model
The landscaping app now needs to think in three layers:
1. Job planning and pricing
2. Session-level execution and supervisor signoff
3. Labor/reassignment/accounting detail
Do not collapse recurring service visits into only the parent job record.

## 2026-04-16 context addition
- This landscaping/service-business app now carries the beginnings of true job costing.
- A job can have sessions, crew-hour logs, reassignments, pricing templates, Ontario tax defaults, and now financial adjustment events plus labor-rate-aware profitability rollups.
- When continuing from this point, prefer DB-backed rollup improvements over note-based workarounds.
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

## 085 implementation notes
This pass adds attendance-photo storage metadata, geofence evaluation against site coordinates/radius, service execution scheduler runs/candidates, provider-specific payroll export generation, and signed-contract invoice support. Treat `jobs.service_contract_reference = recurring_service_agreements.agreement_code` as the current scheduler link rule.


## 2026-04-21 sync note

This repo is now aligned through schema pass 088. The newest operational additions are scheduler cron/dispatch support, evidence review actions, signed-contract kickoff into job/work-order/session records, and payroll delivery/close workflow states.

## 2026-04-22 context refresh
- Canonical schema truth is now portable for scheduler secret lookup: Vault first when available, `app.settings.*` fallback otherwise.
- Payroll exports are intended to progress delivered -> confirmed -> closed, not jump straight to closed.
- Image score language should stay framed as a rule-based completeness score, not an AI quality rating.

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

## 2026-04-25 corrective actions + training pass
- Synced the repo to include first-class corrective-action tasks, training / certification expiry tracking, SDS acknowledgement history, and management-focused reporting.
- See `docs/CORRECTIVE_ACTIONS_AND_TRAINING.md` and the new `sql/091_corrective_actions_training_and_sds_tracking.sql` migration.


Recent pass: 092_management_workflows_and_subscriptions adds report subscriptions, overdue alerts, site/supervisor scorecards, worker self-ack training support, and equipment-specific JSA/hazard linkage.

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
