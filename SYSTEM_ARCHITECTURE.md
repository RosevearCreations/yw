# System Architecture

Last refreshed: **2026-05-17a**

## Frontend

The static app loads `index.html`, `style.css`, `app.js`, feature UI modules, and a service worker. Current cache/version marker is `2026-05-17a`.

## Admin UI

`js/admin-ui.js` renders Admin Command Center, Staff Directory, Operations Backbone, Health, Evidence, Guided Close, and production-readiness panels. Staff and Jobs list controls now use local UI state and send paging/sort metadata to `admin-directory`.

## Backend

Supabase Edge Functions provide authenticated reads/writes. Current pass updates `supabase/functions/admin-directory/index.ts` with sanitized sort allowlists, Staff metadata, Jobs metadata, and fast paths for `scope: people` and `scope: operations`.

## Database

SQL migrations live under `sql/`. The canonical reference file is `sql/000_full_schema_reference.sql`. Latest marker is schema 112.

## Offline/cache

The service worker cache is versioned. After each deployment, hard refresh or unregister the service worker if older files remain visible.
