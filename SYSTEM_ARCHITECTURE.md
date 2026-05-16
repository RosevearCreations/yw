# System Architecture

Last refreshed: **2026-05-15b**

## Main pieces

- Static frontend: `index.html`, `style.css`, `app.js`, and `js/*` modules.
- Supabase database: SQL migrations under `sql/`.
- Supabase Edge Functions: `supabase/functions/*`.
- Service worker: `server-worker.js` for app-shell caching.
- Admin backend: `admin-directory`, `admin-manage`, and `admin-selectors`.

## Current Admin data flow

1. Frontend Admin UI calls `YWIAPI.loadAdminDirectory()`.
2. `admin-directory` loads dashboard/readiness/evidence/accounting views.
3. Admin write actions call `YWIAPI.manageAdminEntity()`.
4. `admin-manage` writes saved filters, health notes, deployment gate status, and existing workflow entities.
5. `app_schema_versions` and `v_schema_drift_status` show live schema status.

## Production direction

The app is being moved toward role-based dashboards, guided workflows, deployment gates, health resolution, accounting close controls, and evidence-backed operations.
