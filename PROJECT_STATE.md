# Project State

Last refreshed: **2026-05-15a**

## Current status

The app now has a clearer Admin landing experience instead of only raw database-style managers. The new Admin Command Center summarizes the major work queues, while the Health and Schema Center gives operators a place to check timeouts, local diagnostics, and the live schema marker.

## Completed in this pass

- Removed reintroduced active temp files.
- Archived root legacy Markdown again instead of keeping it in the active root.
- Retired the old `sql/VerifyDB_24_04_2026.sql` helper from active `sql/`.
- Added schema **106**.
- Added `public.app_schema_versions` tracking.
- Added Admin Command Center database views.
- Added Admin Error/Health Center database view.
- Added DB-backed Admin Task Inbox view.
- Added role dashboard preset view.
- Added frontend Admin Home Command Center.
- Added frontend App Health and Schema Center.
- Added frontend Admin Task Inbox.
- Added stronger API timeout and network-error diagnostic dispatch.
- Added mobile/card CSS polish for admin dashboard workflows.
- Bumped app/cache version to `2026-05-15a`.
- Updated smoke checks to require schema 106 and verify retired files stay out of active root/sql.

## Still needs live testing after deploy

- Confirm schema 106 applies cleanly to the live Supabase project.
- Confirm `admin-directory` returns the new health/task/schema views.
- Confirm the Admin Command Center shows meaningful counts with live data.
- Confirm Health Center shows local diagnostics after a timeout or failed request.
- Confirm the Admin Task Inbox rows drill into useful workflows.
- Confirm no service worker stale-cache issue remains after deploy.
