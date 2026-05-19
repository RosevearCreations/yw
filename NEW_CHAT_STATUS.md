# New Chat Status

Build label: **2026-05-18a**

## What changed most recently

Admin no longer starts by depending only on one large `scope: all` backend request. It now tries smaller staged requests for Health, People, Operations, and Accounting, and only falls back to the heavy all-scope request if all staged requests fail.

## Files changed

- `js/admin-ui.js`
- `index.html`
- `server-worker.js`
- `sql/114_staged_admin_load_and_cache_fallback_guardrails.sql`
- `sql/000_full_schema_reference.sql`
- `scripts/repo-smoke-check.mjs`
- `supabase/functions/report-subscription-delivery-run/index.ts`
- Active Markdown docs

## Next deploy

Apply SQL through schema 114, redeploy `admin-directory` and `admin-manage`, then clear the service worker cache.
