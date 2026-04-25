## 2026-04-23 note
Scheduler reliability now includes two guards: the Edge Function recalculates `next_run_at` after a successful run, and SQL skips rows already queued in the last 10 minutes.

<!-- Reviewed during 2026-04-22 workflow guardrail, portable scheduler sync, and repo-alignment pass. -->
<!-- Reviewed during schema 086 HSE ops performance and site-activity rollup pass on 2026-04-20. -->
# Attendance Photos, Geofence, Scheduler, and Signed-Contract Invoice Flow

This pass adds:
- attendance photo upload/storage linked to employee time entries
- geofence evaluation against site coordinates and configured radius
- service execution scheduler runs for signed agreements with linked jobs
- provider-specific payroll export layouts
- contract-to-invoice generation only when the contract document is signed

Next likely follow-up work:
- background/cron invocation of the scheduler edge function
- full map/geofence admin setup UX
- provider-specific file QA against real payroll vendor imports
- signed acceptance capture beyond status/manual fields


## 2026-04-21 sync note

Attendance photo review now stores approve / reject / follow-up outcomes in `media_review_actions`, and scheduler settings now include dispatch metadata plus cron-ready next-run handling.

## 2026-04-22 scheduler note
When documenting scheduler setup, describe the secret source as Vault-preferred but fallback-capable so local or non-Vault environments do not drift from the canonical repo SQL.

## 2026-04-24 auth wall, historical reports, and OSHA reporting pass
- Fixed the public auth wall so logged-out users no longer see the live Toolbox Talk, PPE Check, First Aid Kit, Site Inspection, or Emergency Drill screens underneath the sign-in interface.
- Added a supervisor/admin **Historical Reports** screen with export-ready HSE form history, site/form rollups, and cross-workflow history covering submissions, HSE packet events, evidence review, scheduler runs, payroll exports, and signed contracts.
- Added migration `sql/089_historical_reporting_and_auth_wall_support.sql` and synced the full schema reference so reporting stays DB-backed instead of drifting into browser-only JSON snapshots.
- Continued the OSHA-facing direction by keeping the five field forms first-class while making their historical retrieval and review more usable for office and supervisor follow-up.
- Next strongest follow-up: add incident / near-miss reporting, saved report presets, richer trend charts, and deeper drill-down exports by site, worker, route, and work-order context.

