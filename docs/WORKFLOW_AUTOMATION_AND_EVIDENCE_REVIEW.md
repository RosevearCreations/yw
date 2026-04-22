<!-- Reviewed during 2026-04-22 portable scheduler fallback, evidence review polish, signed-contract kickoff, payroll-close confirmation, and image-score documentation pass. -->
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
