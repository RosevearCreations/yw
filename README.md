# YWI Operations App

Last refreshed: **2026-05-16b**  
Latest schema marker: **111**  
Current frontend/cache version: **2026-05-16b**

## Current focus

This build continues the production-readiness push after the mobile menu pass. The Admin app now has a more realistic Staff Directory workflow: compact mobile navigation remains in place, Staff Directory lists can be searched/filtered/paged, saved admin views replay Staff Directory filters, and `admin-directory` returns pagination metadata for people and jobs.

## Most important changes in this build

- Added Staff Directory search, role filter, page-size, previous, next, and apply controls.
- Updated `admin-directory` to accept people/jobs pagination inputs and return `pagination_meta`.
- Added a safer paged jobs query path to reduce large Admin payloads.
- Expanded saved admin views so they replay Staff Directory filters, not just the Admin section.
- Added schema **111** for pagination/saved-view replay quality gates.
- Updated `sql/000_full_schema_reference.sql` through schema 111.
- Bumped cache/script version to `2026-05-16b`.
- Re-archived retired Markdown and removed recurring temp files.
- Verified the app shell still has one H1.

## Deploy order

1. Apply SQL through `sql/111_admin_directory_pagination_saved_view_replay.sql`.
2. Redeploy Supabase Edge Functions:
   - `admin-directory`
   - `admin-manage` if not already current from the previous pass.
3. Deploy the static app.
4. Hard refresh or clear the service worker cache.
5. Open Admin on desktop and mobile widths and test the Staff Directory pager.

## Validation commands used

```bash
node --check js/mobile-menu.js
node --check js/api.js
node --check js/admin-ui.js
node --check js/reports-ui.js
node --check js/jobs-ui.js
node --check js/hse-ops-ui.js
node --check js/logbook-ui.js
node --check app.js
node --check server-worker.js
node scripts/repo-smoke-check.mjs
```
