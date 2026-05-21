# System Architecture

Last refreshed: **2026-05-20a**

## Current shape

- Static frontend: `index.html`, `style.css`, `app.js`, and feature modules in `js/`.
- Supabase Edge Functions: `admin-directory`, `admin-manage`, reporting/scheduler functions, jobs functions, and upload helpers.
- Database: Supabase/Postgres migrations in `sql/`, with `000_full_schema_reference.sql` kept current.
- Service worker: `server-worker.js` app-shell cache, currently versioned `2026-05-20a`.

## Admin loading pattern

1. Admin loads `command_center` first.
2. `command_center` returns the fast-path scope registry if schema/function deployment is current.
3. The UI uses the registry for the staged initial Admin scopes.
4. If the registry is unavailable, the UI uses the built-in safe fallback scope list.
5. If every staged panel fails, the old broad `scope: all` call remains as an emergency fallback.

## Readiness pattern

Production Readiness now combines:

- schema drift
- production readiness checks
- role permission matrix
- deployment gates
- deployment checklist items
- function readiness rows
- SEO smoke checks
- bank CSV import and backup rehearsal state
