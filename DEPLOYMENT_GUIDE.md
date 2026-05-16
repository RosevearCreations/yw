# Deployment Guide

Last refreshed: **2026-05-15c**

## Required deployment order

1. Apply SQL migrations through schema **109**.
2. Redeploy Supabase functions:
   - `admin-directory`
   - `admin-manage`
3. Deploy static app files.
4. Clear/hard refresh browser cache or unregister the service worker if old files stay loaded.
5. Run a smoke test after deployment.

## Local checks before packaging

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

## Live checks after deployment

- Admin Health shows schema **109** current.
- Guided Close Center buttons work.
- Evidence follow-up creates queue rows.
- Readiness panel loads audit, backup, CSV import, mobile, deployment, and SEO rows.
- No more than one H1 appears on exposed public pages.
