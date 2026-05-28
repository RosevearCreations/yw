# System Architecture

Last refreshed: **2026-05-26a**

## Current shape

- Single-page app shell in `index.html`.
- Frontend modules in `js/`.
- Service worker app shell cache in `server-worker.js`.
- Supabase Edge Functions under `supabase/functions/`.
- SQL migrations under `sql/` with `sql/000_full_schema_reference.sql` as the canonical reference.

## Current architecture direction

- Mobile-first field usage before desktop-heavy tables.
- Staged Admin fast paths instead of one giant Admin payload.
- DB-backed readiness, permission, retry, mobile, and wording registries.
- Cached fallbacks when live Admin panels fail.
- One exposed H1 in the app shell.

## Latest architecture addition

Schema 120 adds mobile-first and Ontario wording gates. The app shell adds a bottom mobile quick-action bar while keeping the existing compact expandable main menu.
