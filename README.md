# YWI App

Last refreshed: **2026-05-14b**

This build is the current clean working package for the YWI / YardWeasels-style HSE, operations, jobs, admin, and accounting backend app.

## Current status

- Current app/cache version: `2026-05-14b`.
- Latest schema file: `sql/107_admin_readiness_drilldowns_and_live_schema_fix.sql`.
- Active Markdown has been refreshed; older root Markdown and legacy pass notes were archived.
- Admin now has command, health/schema, task inbox, guided close, evidence manager, and production readiness foundations.
- The live SQL fixes for missing `app_schema_versions` and `jobs.job_status` assumptions are folded into the repo.

## Deploy order

1. Apply SQL migrations through schema **107**.
2. Redeploy Supabase Edge Functions, especially `admin-directory` and `admin-selectors`.
3. Deploy static files.
4. Hard refresh the browser or clear old service worker cache.
5. Open Admin and verify Command Center, Health, Close Center, Evidence Manager, and Readiness panels.

## SEO rule kept during this pass

Keep one clear H1 per exposed page. Use the terms people search for in page titles, main headings, alt text, and helpful link text. For local discovery, keep service area wording accurate and visible; local ranking is still driven by relevance, distance, and prominence.

References:
- Google Search Essentials: https://developers.google.com/search/docs/essentials
- Google title-link guidance: https://developers.google.com/search/docs/appearance/title-link
- Google Business Profile local ranking: https://support.google.com/business/answer/7091
