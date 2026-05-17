# Deployment Guide

Last refreshed: **2026-05-17a**

## Required order

1. Apply SQL through schema 112.
2. Redeploy Supabase Edge Function `admin-directory`.
3. Deploy static files.
4. Clear the browser/service-worker cache.
5. Validate Admin on desktop and mobile.

## Post-deploy checks

- Admin Health reports schema 112 current.
- Staff Directory shows search, role, sort, direction, rows, previous, and next.
- Jobs/Operations shows search, sort, direction, rows, previous, and next.
- Saved views replay Staff and Jobs filters.
- `node scripts/repo-smoke-check.mjs` passes if run locally.
- `index.html` still has one H1.

## Cache warning

If the old menu or old Admin list controls appear after deployment, unregister the service worker and refresh again. Current expected cache is `ywi-shell-v2026-05-17a`.
