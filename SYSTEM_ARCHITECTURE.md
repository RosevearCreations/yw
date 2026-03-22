# SYSTEM_ARCHITECTURE.md

YWI HSE uses a static modular frontend with Supabase backend services.

## Layers

### Frontend

- route and UI shell: `index.html`, `style.css`, `js/router.js`
- auth and session recovery: `js/bootstrap.js`, `js/auth.js`, `js/ui-auth.js`
- role/tier logic: `js/security.js`
- API helpers: `js/api.js`
- account security UI: `js/account-ui.js`
- feature modules: `js/admin-ui.js`, `js/logbook-ui.js`, `js/forms-*`

### Backend

- Supabase Auth
- Supabase Postgres
- Supabase Edge Functions
- Supabase Storage

## Current frontend security flow

1. Supabase callback/session is restored by `js/bootstrap.js`
2. `js/auth.js` maintains shared auth state
3. `js/security.js` maps the active role to an access profile
4. UI modules show/hide or lock read-only/manage features accordingly
5. real secure enforcement must still happen in Edge Functions and SQL/RLS

## Current tier model

- worker/staff
- site_leader
- supervisor
- hse
- job_admin
- admin

Frontend use:

- review gate
- directory view gate
- management gate
- account security rendering

## Important note

Frontend gating is convenience UX, not the final source of truth. Backend and SQL helper functions must enforce real access.
