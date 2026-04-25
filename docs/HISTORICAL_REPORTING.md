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
