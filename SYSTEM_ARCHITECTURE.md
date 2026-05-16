# System Architecture

Last refreshed: **2026-05-14b**

## Layers

- Static app shell: `index.html`, `style.css`, `app.js`, and `js/` modules.
- Service worker: `server-worker.js`, cache `ywi-shell-v2026-05-14b`.
- Supabase Edge Functions: auth, admin directory/manage/selectors, jobs, reports, upload handlers, schedulers.
- Supabase Postgres: schema migrations through 107.

## Admin architecture

Admin is now organized around:

- Command Center
- Health and Schema Center
- Task Inbox
- Guided Close Center
- Evidence Manager
- Production Readiness and Permissions
- Staff/access, operations, accounting, messaging, and smoke checks
