# System Architecture

Last refreshed: **2026-05-16b**

## App layers

- Static frontend: `index.html`, `style.css`, `app.js`, and files in `js/`.
- Service worker: `server-worker.js`, versioned as `2026-05-16b`.
- Supabase Edge Functions: `admin-directory`, `admin-manage`, `admin-selectors`, and other API functions.
- Supabase/Postgres schema: SQL migrations through schema 111.

## Current production-readiness direction

The Admin backend is being split into smaller, safer read paths rather than one huge payload. Staff Directory now sends list controls to `admin-directory`; the Edge Function returns `pagination_meta` so the UI can show real page state.

## Important pattern

Keep UI controls, Edge Function payloads, schema markers, and Markdown in sync every pass. This avoids the repeated drift where the UI expects a table/view/function that the live database has not applied yet.
