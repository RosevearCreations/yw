# Testing Checklist

Last refreshed: **2026-05-20b**

## Smoke checks

Run from the repo root when local tools are available:

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

## Manual Admin checks

- Admin loads Command Center first.
- Admin continues loading staged panels after Command Center.
- Admin > Readiness shows:
  - Schema Preflight,
  - Production Checks,
  - Role Permissions,
  - Action Permissions,
  - Deployment Gates,
  - Deployment Checklist,
  - Panel Retry Policy,
  - Function Readiness,
  - SEO Smoke.
- Job complete/cancel buttons are disabled for roles below `job_admin`.
- Close step reopen is disabled for non-admin roles.
- Deployment gate mark-pass is disabled for non-admin roles.
- Evidence follow-up is disabled below the configured HSE/job-admin/admin threshold.

## Public checks

- `index.html` has no more than one H1.
- Mobile main menu starts collapsed and expands cleanly.
- Admin section menu remains usable on a phone-width viewport.
- CSS braces remain balanced.
