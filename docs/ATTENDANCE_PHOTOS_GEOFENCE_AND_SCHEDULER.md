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
