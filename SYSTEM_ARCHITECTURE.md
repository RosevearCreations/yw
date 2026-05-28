# System Architecture

Last refreshed: **2026-05-27a**

## Frontend

- Single-page app shell in `index.html`.
- Shared router in `js/router.js`.
- Mobile navigation in `js/mobile-menu.js`.
- Mobile Today dashboard in `js/mobile-today.js`.
- Offline queues in `js/outbox.js`.
- Service worker app shell in `server-worker.js`.

## Backend

- Supabase Edge Functions provide Admin directory/management data.
- Schema tracking is handled with numbered SQL migration files and `app_schema_versions`.
- Admin data loading is split into staged scopes so mobile/Admin screens are less likely to time out.

## Current design rule

Prioritize mobile screens first, then widen gracefully for desktop Admin use.
