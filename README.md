# YWI HSE / Operations App

Last refreshed: **2026-05-15b**

This build is the current working app package for the YWI HSE, operations, jobs, reporting, accounting-close, and admin backend workflow.

## Current focus

The app is moving from working screens toward production-style operations. The latest pass adds Admin saved views, Guided Close Center step metadata, health/evidence follow-up logging, deployment gates, and a public SEO smoke-check foundation.

## Latest schema

Apply SQL through:

- `sql/108_saved_filters_close_wizard_health_and_seo_gates.sql`

The canonical snapshot is also updated in:

- `sql/000_full_schema_reference.sql`

## Deploy notes

Redeploy changed Supabase Edge Functions after applying SQL:

- `admin-directory`
- `admin-manage`

Then hard refresh or clear service worker cache so `2026-05-15b` frontend files load.

## Validation command

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

## Active planning files

- `DEVELOPMENT_ROADMAP.md`
- `KNOWN_ISSUES_AND_GAPS.md`
- `PROJECT_STATE.md`
- `NEW_CHAT_STATUS.md`
- `DATABASE_STRUCTURE.md`
- `TESTING_CHECKLIST.md`
- `DEPLOYMENT_GUIDE.md`
