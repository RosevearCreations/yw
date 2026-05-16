# Deployment Guide

Last refreshed: **2026-05-15b**

## Deploy order

1. Backup the live database or confirm a recent backup exists.
2. Apply SQL migrations through `sql/108_saved_filters_close_wizard_health_and_seo_gates.sql`.
3. Redeploy changed Supabase functions:
   - `admin-directory`
   - `admin-manage`
4. Deploy the static frontend.
5. Hard refresh browser cache or unregister the old service worker if old assets remain.
6. Open Admin Health and confirm schema drift says current.
7. Test saved views, Evidence Manager follow-up, deployment gate Mark Pass, and Guided Close Center cards.

## Pre-deploy checks

```bash
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

## Cache note

The service worker cache is now `ywi-shell-v2026-05-15b`. If the browser still loads `2026-05-14b`, clear site data or unregister the service worker.
