# Deployment Guide

Last refreshed: **2026-05-10**

## Before deploying

Run:

```bash
node --check js/api.js
node --check js/reports-ui.js
node --check js/admin-ui.js
node --check js/jobs-ui.js
node --check app.js
node --check server-worker.js
node scripts/repo-smoke-check.mjs
```

Check:

- `index.html` has no more than one `<h1>`.
- `server-worker.js` cache name matches the current version.
- `index.html` script/style query strings match the current version.
- New SQL migrations are present and the full schema reference is updated.
- Markdown reflects the new state.

## Database deployment

Apply migrations in order through:

```text
sql/105_repo_cleanup_and_roadmap_refresh.sql
```

Then confirm these marker views exist:

- `v_reporting_loader_health`
- `v_repo_cleanup_and_roadmap_health`

## Function deployment

Redeploy Supabase functions when their source changes. Recent important functions include:

- `admin-directory`
- `admin-manage`
- `admin-selectors`
- `jobs-directory`
- `jobs-manage`
- `account-maintenance`
- `service-execution-scheduler-run`
- `report-subscription-delivery-run`

## Frontend deployment

Deploy the static app after DB/function changes are live.

After deployment:

1. Hard refresh.
2. Confirm the service worker uses the newest cache.
3. Open `#admin` and confirm Reports do not auto-load.
4. Open `#reports` and confirm reports load only there.
5. Open `#jobs`, `#hseops`, `#settings`, and `#me`.
6. Check browser console for missing assets, failed functions, or stale-cache errors.

## Rollback note

If the frontend is deployed before schema/function changes, workflow screens may show missing-view or timeout messages. Keep the previous ZIP and deploy logs until live verification passes.
