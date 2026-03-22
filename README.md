# YWI HSE Safety System

YWI HSE is a Supabase-backed safety and compliance web app for field and site operations.

It supports structured safety forms, evidence images, review workflows, tiered access control, logbook lookup/export, and admin management for profiles, sites, and assignments.

---

# Current Status

The current build is functional and now more modular than the earlier single-file version.

This pass adds:

- shared role/security helpers
- an in-app account security panel
- password create/change support after sign-in
- global sign-out support
- tiered admin directory access
- more modular frontend separation
- full markdown sync

---

# Frontend Architecture

Main files:

- `index.html` — single-page app shell
- `style.css` — app styling
- `app.js` — shared shell, state wiring, outbox/admin actions

Shared modules:

- `js/router.js` — hash routing
- `js/bootstrap.js` — Supabase bootstrap and auth callback recovery
- `js/security.js` — shared role tier and permission helpers
- `js/auth.js` — auth controller
- `js/api.js` — authenticated function/upload API helpers
- `js/ui-auth.js` — login/logout UI
- `js/account-ui.js` — in-app password/account security panel
- `js/admin-ui.js` — admin directory and management UI
- `js/logbook-ui.js` — logbook, detail, review, CSV export

Form modules:

- `js/forms-toolbox.js`
- `js/forms-ppe.js`
- `js/forms-firstaid.js`
- `js/forms-inspection.js`
- `js/forms-drill.js`

Support files:

- `manifest.json`
- `server-worker.js`

---

# Security Model

Authentication uses Supabase Auth.

Current frontend auth support:

- magic link sign-in
- email + password sign-in UI
- password reset email flow
- password create/change in-app after sign-in
- logout
- logout everywhere (global sign-out)
- callback/session recovery for malformed auth URLs

## Tiered access model

Current role values used by the frontend/docs:

- `worker`
- `staff`
- `onsite_admin`
- `site_leader`
- `supervisor`
- `hse`
- `job_admin`
- `admin`

Current UI behavior:

- worker/staff: standard form access
- site_leader and above: submission review access
- supervisor/hse/job_admin/admin: directory view access
- admin: full create/update/delete admin management

Important: frontend visibility is only one layer. Real enforcement must still happen in Edge Functions, SQL helpers, and RLS/policies.

---

# Main Features

- Toolbox Talk form
- PPE Check form
- First Aid Kit Check form
- Site Inspection form
- Emergency Drill form
- optional image uploads
- submission detail viewer
- review history and status updates
- CSV export from the logbook
- admin directory for users/sites/assignments
- account security panel
- outbox retry for failed submissions

---

# Current Edge Functions Expected

- `resend-email`
- `clever-endpoint`
- `submission-detail`
- `review-submission`
- `admin-directory`
- `admin-manage`
- `admin-selectors`
- `upload-image`

---

# Current Main Tables Expected

- `profiles`
- `sites`
- `site_assignments`
- `submissions`
- `toolbox_attendees`
- `submission_reviews`
- `submission_images`

Storage bucket:

- `submission-images`

---

# Active Priorities

1. finish stronger end-to-end security enforcement in backend/RLS
2. continue modular cleanup so `app.js` becomes smaller over time
3. keep docs aligned with code and SQL helpers
4. verify deployed auth redirect and password-change behavior
5. verify tiered access rules for directory/review actions

---

# Immediate Recommended Next Steps

- add RLS/policy documentation and enforcement checklist
- move admin CRUD actions into a dedicated module after this pass
- move outbox helpers into their own shared module
- add audit logging for role/site assignment changes
- verify role/site access in backend helper functions

---

# Documentation Files

- `README.md`
- `AI_CONTEXT.md`
- `AI_START_PROMPT.md`
- `PROJECT_BRAIN.md`
- `PROJECT_STATE.md`
- `SYSTEM_ARCHITECTURE.md`
- `DATABASE_STRUCTURE.md`
- `REPO_BASE.md`
- `DEPLOYMENT_GUIDE.md`
- `TESTING_CHECKLIST.md`
- `CHANGELOG.md`

These files should be updated whenever auth, architecture, or role rules change.
