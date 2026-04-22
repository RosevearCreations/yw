<!-- Reviewed during 2026-04-22 portable scheduler fallback, evidence review polish, signed-contract kickoff, payroll-close confirmation, and image-score documentation pass. -->
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
