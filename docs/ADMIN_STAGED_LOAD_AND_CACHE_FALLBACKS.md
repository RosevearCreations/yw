# Admin Staged Load and Cache Fallbacks

Last refreshed: **2026-05-18a**

## Why this exists

The Admin screen was showing cached data because the live `admin-directory` request could fail or time out when the frontend asked for one very large `scope: all` payload.

## Current behavior

`js/admin-ui.js` now requests smaller scopes during initial Admin load:

1. `health`
2. `people`
3. `operations`
4. `accounting`

If one scope fails, the app keeps the panels that did load and reports which panel needs retry. If every staged scope fails, the old `all` scope remains available as an emergency fallback. Cached data is still available as the final safety net.

## Files involved

- `js/admin-ui.js`
- `supabase/functions/admin-directory/index.ts`
- `sql/114_staged_admin_load_and_cache_fallback_guardrails.sql`
- `scripts/repo-smoke-check.mjs`

## Manual test

Open `/#admin`, watch network requests, and confirm staged scopes appear before any `scope: all` request.
