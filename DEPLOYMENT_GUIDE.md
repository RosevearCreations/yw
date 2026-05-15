# Deployment Guide

Last refreshed: **2026-05-15a**

## Pre-deploy checks

Run from the repo root:

```bash
node --check js/api.js
node --check js/admin-ui.js
node --check js/reports-ui.js
node --check js/jobs-ui.js
node --check js/hse-ops-ui.js
node --check app.js
node --check server-worker.js
node scripts/repo-smoke-check.mjs
```

## Database

Apply migrations through:

```text
sql/106_admin_command_center_schema_tracking_and_health.sql
```

Then confirm the live database has:

- `app_schema_versions`
- `v_app_schema_version_status`
- `v_admin_home_command_center`
- `v_admin_error_health_center`
- `v_admin_task_inbox`

## Supabase Edge Functions

Redeploy at least:

- `admin-directory`

Recommended to redeploy all changed functions if using a full build pipeline.

## Static app

Deploy the static app files after SQL and functions are updated. The static cache version is `2026-05-15a`.

## Browser test

1. Hard refresh.
2. Log in.
3. Open `#admin`.
4. Confirm Command Center, Health Center, and Task Inbox render.
5. Open `#reports` and confirm reports still lazy-load.
6. Check browser console for missing assets or stale cache references.
