# New Chat Status

Last refreshed: **2026-05-17a**

## Current release package

The latest prepared build is expected to be named:

`yw-main-122-updated-2026-05-17a-admin-list-sorting-operations-pagination.zip`

## What this pass did

This pass focused on making Admin list screens act more like a real production app on desktop and mobile. Staff Directory now has visible sort/direction controls, Jobs/Operations now has visible search/sort/page-size/previous/next controls, and saved admin views replay both Staff and Jobs filters. The `admin-directory` Edge Function now accepts sanitized sort payloads and has narrower `scope: people` and `scope: operations` fast paths.

## Deploy checklist

1. Apply SQL through **schema 112**.
2. Redeploy Supabase Edge Function: `admin-directory`.
3. Deploy static files.
4. Hard refresh or unregister the service worker so `2026-05-17a` assets load.
5. Open Admin on a phone-width viewport and confirm the Staff and Jobs toolbars stack cleanly.
6. Run `node scripts/repo-smoke-check.mjs` from the repo root after deployment if local tooling is available.

## Immediate next work

Start with panel-only refresh buttons, then add a dedicated Operations jobs review table and direct row actions.
