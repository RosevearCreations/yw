# YWI Main App

Current release: **2026-05-17a**

This repo contains the YWI web app shell, Admin UI, HSE forms, jobs/operations tools, reporting screens, Supabase Edge Functions, and SQL schema migrations.

## Current focus

The app is being moved toward production-style workflows:

- safer Admin loading with pagination and smaller payloads
- mobile-friendly navigation and list controls
- schema tracking and health checks
- accounting close and reconciliation workflows
- evidence review and HSE operations
- cleaner Markdown handoff docs and repeatable smoke checks

## Latest pass

Release **2026-05-17a** adds Staff Directory sorting, visible Jobs/Operations pagination controls, sanitized Edge Function sorting, saved-view replay for Staff and Jobs filters, schema 112, updated smoke checks, and refreshed Markdown.

## Deploy order

1. Apply SQL migrations through `sql/112_admin_operations_pagination_sorting_panel_refresh.sql`.
2. Redeploy Supabase Edge Function `admin-directory`.
3. Deploy the static app.
4. Hard refresh or clear the service worker cache.
5. Test Admin on desktop and mobile widths.

## Validation

Run:

```bash
node --check js/admin-ui.js
node --check js/api.js
node --check app.js
node --check server-worker.js
node scripts/repo-smoke-check.mjs
```
