# AI_CONTEXT.md

Read this first when continuing the YWI HSE project.

## Project identity

YWI HSE is a Supabase-backed safety/compliance app for field and site operations.

It currently supports:

- safety form submission
- evidence image uploads
- logbook search/export
- review workflows
- admin directory and management
- in-app account security controls

## Current architecture

The frontend is now modular.

Core modules:

- `js/router.js`
- `js/bootstrap.js`
- `js/security.js`
- `js/auth.js`
- `js/api.js`
- `js/ui-auth.js`
- `js/account-ui.js`
- `js/admin-ui.js`
- `js/logbook-ui.js`
- `js/forms-*`

The app still runs as a static frontend with Supabase for auth, database, storage, and backend functions.

## Important current security direction

Recent work added:

- callback/session recovery for tricky magic-link URLs
- in-app password create/change
- global sign-out support
- a shared role/permission helper
- tiered admin directory access

Tier behavior now expected in frontend/docs:

- worker/staff: standard form use
- site_leader+: review access
- supervisor/hse/job_admin/admin: read-only directory access
- admin: full management access

## Current focus

Primary:

- stronger login/logout/account security
- more modular separation
- keep docs current

Secondary:

- move more shell logic out of `app.js`
- continue backend/RLS alignment with the frontend tier model

## Safe continuation rule

Do not collapse modules back into one large file.
Do not remove auth callback recovery protections.
Do not change role names casually.
Do not rely on frontend-only security.

## Best restart prompt

Read `AI_CONTEXT.md` and `PROJECT_BRAIN.md` first. Current focus: security tiers, account security, modular cleanup, and markdown sync.
