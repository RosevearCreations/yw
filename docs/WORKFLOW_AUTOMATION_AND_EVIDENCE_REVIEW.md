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
