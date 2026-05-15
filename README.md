# YWI Southern Ontario HSE and Field Operations App

Last refreshed: **2026-05-15a**

This build is a single-page HSE, jobs, field operations, reporting, admin, and accounting-control app. It is moving from prototype screens toward an operations dashboard with clearer admin workflows, live schema awareness, and better error handling.

## Current build focus

- Admin Home Command Center for open jobs, HSE reviews, accounting close, payment applications, reconciliation, package delivery, failed uploads, and app health.
- App Health and Schema Center for local diagnostics, backend health rows, and live schema migration markers.
- DB-backed Admin Task Inbox for approval, accounting close, reconciliation, tax/remittance, corrective action, and training follow-up.
- Schema tracking table: `public.app_schema_versions`.
- Latest schema file: `sql/106_admin_command_center_schema_tracking_and_health.sql`.
- Current frontend/cache version: `2026-05-15a`.

## Important files

- `index.html` — app shell; currently one public `<h1>`.
- `style.css` — shared UI, responsive tables, admin cards, command center, and mobile polish.
- `app.js` — app startup, diagnostics, auth-aware module boot, routing hooks.
- `js/api.js` — shared API client, timeout handling, validation events, monitor/error dispatch.
- `js/admin-ui.js` — Admin UI, Command Center, Health Center, Task Inbox, accounting/admin managers.
- `supabase/functions/admin-directory/index.ts` — main read API for admin/ops/accounting/reporting data.
- `sql/000_full_schema_reference.sql` — canonical schema snapshot through schema 106.
- `scripts/repo-smoke-check.mjs` — local repo sanity check.

## Deployment order

1. Apply SQL migrations through **106**.
2. Redeploy Supabase Edge Functions, especially `admin-directory`.
3. Deploy the static app shell and assets.
4. Hard refresh or clear service worker cache if the browser keeps old `2026-05-10a` assets.
5. Open `#admin`, confirm the Command Center and Health Center load.
6. Open `#reports`, confirm Reports still lazy-load only when requested.

## SEO rule for every public page

Keep public page titles and headings descriptive, local, and useful. Exposed pages should have no more than one visible `<h1>`. If public marketing pages are added, use service/town wording, proof content, useful text around images, and clean URLs.

References:

- https://developers.google.com/search/docs/essentials
- https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- https://support.google.com/business/answer/7091
