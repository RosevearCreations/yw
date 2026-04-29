# Historical Reporting

## Current scope

The Historical Reports screen is a supervisor/admin reporting surface built from DB-backed views rather than browser-only JSON.

It currently exposes:
- HSE submission history across Toolbox Talk, PPE Check, First Aid Kit, Site Inspection, and Emergency Drill
- Site/form rollups for quick supervisor follow-up
- Workflow history across submissions, HSE packet events, evidence review, scheduler runs, payroll exports, and signed contracts

## Why this matters

This keeps OSHA-facing form history retrievable in one place and reduces the risk that operational follow-up depends on local browser state or manual exports.

## Current data sources

- `v_hse_submission_history_report`
- `v_hse_form_daily_rollup`
- `v_hse_form_site_rollup`
- `v_workflow_history_report`

## Current UI behavior

- date filters default to the last 30 days
- HSE and workflow tables can be exported to CSV
- the screen is hidden from logged-out users and requires supervisor-or-higher access

## Best next follow-ups

- saved report presets
- trend charts for rejection/follow-up volume
- worker/site/route/work-order drilldowns
- incident / near-miss reporting and export alignment

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
