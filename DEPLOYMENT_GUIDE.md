# Deployment Guide

Last refreshed: **2026-05-16a**

## Required deployment order

1. Apply SQL migrations through schema **110**.
2. Redeploy Supabase function:
   - `admin-directory`
3. Deploy static app files.
4. Clear/hard refresh browser cache or unregister the service worker if old files stay loaded.
5. Run a smoke test after deployment.

## Local checks before packaging

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

## Live checks after deployment

- Main phone menu is compact on load.
- Admin section phone menu is compact on load.
- Admin Health shows schema **110** current.
- No more than one H1 appears on exposed public pages.
