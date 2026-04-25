## 2026-04-23 note
Scheduler reliability now includes two guards: the Edge Function recalculates `next_run_at` after a successful run, and SQL skips rows already queued in the last 10 minutes.

<!-- Reviewed during 2026-04-22 workflow guardrail, portable scheduler sync, and repo-alignment pass. -->
# Workflow Automation and Evidence Review

Reviewed and updated during schema 087 on 2026-04-20.

## What this pass improves
- Attendance and HSE evidence now have dedicated Admin review lanes instead of living only inside individual record forms.
- Service execution scheduling now has a settings table and status view so it can move toward real timed invocation.
- Signed contracts now have a live-job kickoff path instead of stopping at document/invoice staging.
- Payroll close review now shows whether export delivery is ready or still blocked by attendance exceptions and unexported hours.
- Admin selector loading is lighter for backbone forms through the new `admin_core` selector scope.
- Site activity rollups can now drill into filtered Admin records more directly.

## Remaining follow-on work
1. Persist uploaded attendance/HSE images into richer gallery-style review screens with approve/reject notes.
2. Wire a real platform scheduler/cron to call the service execution scheduler with the shared secret.
3. Convert signed-contract kickoff from job-only creation into job + work-order + initial session orchestration where appropriate.
4. Add provider-specific payroll delivery receipts / acknowledgement logging after export generation.
5. Continue trimming heavy Admin payloads by splitting dashboard, backbone, and evidence review loads even further.


## 2026-04-21 sync note

Workflow automation now includes:
- cron-ready scheduler dispatch support
- stored evidence review actions
- signed-contract kickoff into live operations records
- payroll delivery confirmation and close signoff after export generation

## 2026-04-22 workflow polish note
Evidence review buttons now prompt for clearer optional notes, payroll close is intentionally sequential, and signed-contract kickoff messaging now surfaces job/work-order/session results more clearly to the operator.


## Current guardrails
- Rejected and follow-up evidence reviews now require notes so later payroll / exception review has clearer operator context.
- Payroll export delivery now expects a delivery reference before the run is marked delivered or confirmed.
- Payroll close now requires a signoff note before the run can be closed.

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
