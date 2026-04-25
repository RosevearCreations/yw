<!-- Reviewed during 2026-04-22 workflow guardrail, portable scheduler sync, and repo-alignment pass. -->
<!-- Reviewed during schema 086 HSE ops performance and site-activity rollup pass on 2026-04-20. -->
# Employee Time Clock and Attendance

This pass adds a self-service employee attendance layer tied to jobs, sites, job sessions, and payroll-linked crew hours.

## What employees can do
- Clock in on arrival to a site/job
- Start an unpaid break
- End an unpaid break
- Clock out when leaving the site

## What the system records
- arrival/sign-in time
- break start and break end
- paid minutes and unpaid break minutes
- linked job and job session
- linked crew-hour row for payroll and job costing
- admin-visible site activity events

## Suggested next steps
- supervisor exception approval for missing/late clock-out
- optional arrival/departure photo proof
- optional geofence or GPS note capture
- payroll export file generation
- supervisor signoff on attendance exceptions

## 085 enhancements
- Attendance photos can now be uploaded and tied to clock-in / clock-out rows.
- Geofence checks now compare captured coordinates to configured site coordinates and radius.
- Outside-geofence results can open attendance exceptions for supervisor review.


## 2026-04-21 sync note

Attendance exceptions and media review are now closer together operationally: evidence review actions can update the stored review state while payroll-close summaries continue surfacing remaining attendance review work.

## 2026-04-22 attendance-review note
Attendance evidence review remains rule-driven and operator-reviewed; follow-up notes should be captured during approve/reject/follow-up actions so later payroll close checks have better context.

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
