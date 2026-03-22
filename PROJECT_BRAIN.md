# PROJECT_BRAIN.md

Primary project memory for the YWI HSE Safety System.

## What the project is

YWI HSE is a static frontend + Supabase backend app for site safety workflows.

Main capabilities:

- digital safety forms
- image evidence
- review workflow
- logbook/detail export
- user/site/assignment administration
- account security controls

## Current real structure

Root files:

- `index.html`
- `style.css`
- `app.js`

Shared modules:

- `js/router.js`
- `js/bootstrap.js`
- `js/security.js`
- `js/auth.js`
- `js/api.js`
- `js/ui-auth.js`
- `js/account-ui.js`
- `js/admin-ui.js`
- `js/logbook-ui.js`

Form modules:

- `js/forms-toolbox.js`
- `js/forms-ppe.js`
- `js/forms-firstaid.js`
- `js/forms-inspection.js`
- `js/forms-drill.js`

## Current security direction

Authentication now includes:

- magic link
- password sign-in
- password reset
- in-app password change
- local logout
- global logout everywhere
- auth callback recovery hardening

Shared permission logic now lives in `js/security.js`.

## Role model used in docs/frontend

- `worker`
- `staff`
- `onsite_admin`
- `site_leader`
- `supervisor`
- `hse`
- `job_admin`
- `admin`

Current intended tiers:

- worker/staff: forms only
- site_leader+: reviews
- supervisor/hse/job_admin/admin: admin directory read-only
- admin: admin management write actions

## Current important behavior

- `app.js` now relies on `js/api.js` and `js/security.js`
- `account-ui.js` handles in-app password management
- `admin-ui.js` supports read-only vs manage modes
- `logbook-ui.js` uses shared role checks for review visibility
- `server-worker.js` must cache the new modules

## Current priority

1. backend/RLS enforcement to match the new tiers
2. modularize more shared shell logic
3. keep markdown fully aligned with code and SQL helpers
4. validate deployed auth/password flows
