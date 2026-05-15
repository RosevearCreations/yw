# System Architecture

Last refreshed: **2026-05-15a**

## Frontend

Static single-page app:

- `index.html`
- `style.css`
- `app.js`
- `server-worker.js`
- `js/*.js`

The app uses a hash router and auth-aware module boot. Protected modules only initialize after sign-in and account setup checks pass.

## Backend

Supabase Edge Functions are the active backend API layer. The most important admin read function is:

- `supabase/functions/admin-directory/index.ts`

This function now returns:

- standard admin directory data;
- jobs/operations/accounting manager data;
- reporting fast-path data;
- Admin Command Center data;
- Admin Health and Schema Center data;
- Admin Task Inbox data;
- role dashboard preset data.

## Database

Supabase Postgres stores operational records. SQL migrations are in `sql/` and canonical reference is `sql/000_full_schema_reference.sql`.

Schema 106 adds DB-visible migration tracking with `app_schema_versions`.

## Diagnostics and resilience

- `app.js` exposes `window.YWIAppDiagnostics` and `window.YWIModuleTimings`.
- `js/api.js` dispatches validation, timeout, auth, and network diagnostics.
- Admin Health and Schema Center renders local diagnostics plus DB health rows.
- Service worker cache version is `ywi-shell-v2026-05-15a`.
