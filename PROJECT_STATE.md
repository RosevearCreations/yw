# PROJECT_STATE.md

Current development snapshot for YWI HSE.

## State summary

The app is functional and in active cleanup/security hardening.

This pass added:

- `js/security.js`
- `js/account-ui.js`
- stronger auth helper coverage in `js/auth.js`
- tiered read-only vs manage behavior in `js/admin-ui.js`
- logbook review visibility using shared role checks
- full markdown sync

## What is currently working in principle

- magic link login
- password login UI
- password reset flow
- local logout
- global logout
- in-app password change
- five form modules
- image upload registration flow
- review actions
- admin directory load
- admin management actions (admin only)
- outbox retry

## What changed in the security model

Frontend role checks are now centralized through `js/security.js` instead of being scattered in multiple modules.

Current tier behavior:

- worker/staff: standard use
- site_leader+: review
- supervisor/hse/job_admin/admin: directory view
- admin: management write actions

## Current next steps

- backend enforcement parity with these tiers
- policy/RLS review
- audit logging for admin changes
- continue moving shell logic out of `app.js`
