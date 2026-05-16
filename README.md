# YWI HSE / Operations App

Last refreshed: **2026-05-15c**  
Latest schema: **109**

This build is moving the app from a working prototype toward a production-style operations backend. The current focus is Admin Command Center reliability, accounting close workflows, evidence handling, auditability, pagination, and deployment readiness.

## Current status

- Frontend cache/build version: `2026-05-15c`
- Latest migration: `sql/109_pagination_close_wizard_audit_backup_mobile_foundations.sql`
- Active docs are clean and current; older root Markdown is archived.
- Exposed app shell has one `<h1>`.
- Admin now has DB-backed foundations for close steps, audit events, evidence actions, backup rehearsals, mobile action cards, and bank CSV import staging.

## Deploy order

1. Apply SQL migrations through schema **109**.
2. Redeploy changed Supabase functions: `admin-directory` and `admin-manage`.
3. Deploy the static app files.
4. Hard refresh or clear the service worker cache if older assets keep loading.
5. Run `node scripts/repo-smoke-check.mjs` before treating the build as ready.

## SEO rule kept each pass

Keep one clear H1 per exposed public page. Use normal search terms in titles, headings, alt text, and helpful links. Local discovery work should keep relevance, distance, and prominence signals clear.

References:
- Google Search Essentials: https://developers.google.com/search/docs/essentials
- Google title-link guidance: https://developers.google.com/search/docs/appearance/title-link
- Google Business Profile local ranking: https://support.google.com/business/answer/7091
