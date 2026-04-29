<!-- Reviewed during 2026-04-22 workflow guardrail, portable scheduler sync, and repo-alignment pass. -->
<!-- Reviewed during schema 086 HSE ops performance and site-activity rollup pass on 2026-04-20. -->
<!-- Reviewed during schema 080 recurring agreements / payroll / asset history / login tracking pass on 2026-04-17. -->
# Service agreements, payroll review, asset history, and account tracking

## What this pass adds
- Estimate-to-agreement conversion candidates plus printable contract / application document records.
- Payroll export file generation support and agreement-profitability summaries.
- Snow-event invoice candidates for threshold-met agreement work.
- Recurring service agreements for repeat work such as mowing, snow, foliage clearing, and other visit-based service.
- Snow-event trigger logs for agreements that start work only after a threshold or event.
- Change orders for custom-project scope drift and approved charge/cost deltas.
- Customer assets plus asset-to-job history so repeat properties can keep equipment/feature service records.
- Warranty and callback events so post-job return work is visible as cost leakage or warranty-covered follow-up.
- Payroll export runs and burden-aware payroll review views.
- Admin-visible account login auditing with `profiles.last_login_at` plus per-profile login event counts.

## Why it fits this business model
This app is moving toward a landscaping + recurring service + custom project + accounting backbone. Repeat property work, emergency snow work, scope-change jobs, and warranty/callback costs all need to be first-class records so quoting, invoicing, and profitability can be measured instead of guessed from notes.

## Accounting implications
- Material receipts and material issues now have a clearer path into job-cost rollups.
- Payroll review is now separable from invoice timing so labor burden can be reviewed before export/close.
- Route profitability can now be reviewed by route, crew, and service area.
- Login tracking gives Admin stronger accountability over who last accessed the system.

## Strongest next implementation steps
1. Add signed acceptance and document lifecycle controls on top of the new estimate -> agreement -> printable contract flow.
2. Turn payroll export generation into provider-specific exports and accounting handoff summaries.
3. Surface callback / warranty pressure more aggressively on Admin home cards and route unresolved items into crew follow-up.
4. Tighten agreement profitability and snow-event invoicing into seasonal billing review and posting workflows.

## 2026-04-19 employee time clock and attendance pass

- Added DB-backed `site_activity_events`, `v_site_activity_recent`, and `v_site_activity_summary` so Admin can review durable activity for staff creation/updates, new jobs, equipment changes, agreements, payroll exports, contracts, and related operational changes.
- Admin now loads and renders a Recent Site Activity table directly from the backend instead of relying only on login traces or per-screen notices.
- `admin-manage`, `jobs-manage`, and `account-maintenance` now record key activity events while still failing safely if the audit trail insert itself has a problem.
- Current schema target is now 082.

## 085 enhancements
- Recurring agreements now feed scheduler candidate views and scheduler run logs.
- Signed service contract documents can now be used as invoice-generation sources.
- Payroll export runs now support provider-specific export layouts.


## 2026-04-21 sync note

Service agreements and signed contracts now flow farther into execution: a signed contract can create/link the job, create a work order, and create the first planned session. Scheduler settings also now influence session creation lookahead and eligibility.

## 2026-04-22 signed-contract kickoff note
Signed-contract kickoff now returns clearer downstream feedback so operators can verify the linked job, created work order, and first planned session without guessing which record was produced.

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

## Latest pass note (2026-04-25d)
- Synced for scheduled report delivery, worker self-service training/SDS acknowledgement, and Jobs commercial/accounting foundation planning.

## 2026-04-26 pass note

This pass moves the project into the Jobs commercial/accounting phase.
It adds the 094 Jobs commercial workflow foundation, updates the repo status toward estimate/work-order/completion/accounting readiness, and keeps the schema/docs aligned for the next phase.


## Pass 096 notes

This pass adds branded quote output, automatic threshold evaluation, closeout evidence linkage, invoice/journal posting-rule structures, accountant handoff exports, and profitability/variance scorecards for the Jobs commercial workflow.
