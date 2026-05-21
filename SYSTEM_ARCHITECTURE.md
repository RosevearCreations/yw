# System Architecture

Last refreshed: **2026-05-20b**

## Frontend

- `index.html` loads versioned app-shell assets.
- `server-worker.js` caches app-shell files using cache version `2026-05-20b`.
- `js/mobile-menu.js` controls the compact mobile main menu.
- `js/admin-ui.js` renders the Admin backend, staged panel loading, diagnostics, readiness tables, and role-aware action disabled states.

## Backend

- Supabase Edge Functions provide Admin and workflow APIs.
- `admin-directory` returns staged Admin panel payloads.
- `admin-manage` handles write actions.
- Schema drift and readiness rows are tracked through DB views rather than hard-coded frontend assumptions.

## Admin loading model

1. Load Command Center first.
2. Read the DB-backed fast-path scope registry when available.
3. Load smaller panel scopes.
4. Keep broad `scope: all` only as emergency fallback.
5. Show stale badges, diagnostics, preflight rows, retry rules, and action permissions so failures are visible instead of silent.
