<!-- Reviewed during 2026-04-22 workflow guardrail, portable scheduler sync, and repo-alignment pass. -->
<!-- Reviewed during schema 086 HSE ops performance and site-activity rollup pass on 2026-04-20. -->
<!-- Added during schema 084 supervisor attendance / execution-candidate pass on 2026-04-19. -->
# Supervisor Attendance and Execution Candidates

## What this pass added
- Supervisor review records for missed clock-out, long-break, and related attendance exceptions.
- Time-clock geolocation and photo-note fields on clock in and clock out.
- Payroll export generation from time-clock-linked crew-hour rows.
- Agreement execution candidates so active recurring agreements can stage service-session and invoice candidates.
- Operations dashboard summary counts for active crews, overdue sign-outs, unsigned sessions, delayed jobs, and loss-making jobs.

## Current direction
The app now has a stronger field-to-backoffice flow:
1. Employee arrival / break / departure writes a real time entry.
2. Sign-out syncs labor into crew-hour costing.
3. Supervisors/Admin can review time exceptions.
4. Payroll export runs can generate downloadable file content.
5. Active agreements can stage candidate work/invoice items instead of relying only on notes.

## Next follow-up
- Add actual photo upload for attendance evidence.
- Add site-radius geofence rules and mismatch flags.
- Add scheduled job/session creation from execution candidates.
- Add provider-specific payroll file layouts.

## 085 enhancements
- Attendance review now sits beside stored photo and geofence evidence.
- Execution candidates now have a scheduler-ready companion view and scheduler run tracking.


## 2026-04-21 sync note

Supervisor-facing candidate review now has deeper backend support: attendance evidence can be reviewed with stored outcomes, and scheduler candidates can be run from settings-aware execution logic rather than static candidate views alone.

## 2026-04-22 review sequencing note
Attendance review and scheduler execution now feed directly into payroll-close readiness, so the delivered -> confirmed -> closed payroll sequence should be preserved in testing.

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
