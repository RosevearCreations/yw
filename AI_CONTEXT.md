# AI_CONTEXT.md
# YWI HSE Safety System — AI Context File

This document is the fast-start context file for any AI assistant or new development session working on the YWI HSE Safety System.

Its purpose is to explain:

- what the project is
- how it is currently structured
- what is already working
- what the current focus is
- how to continue safely without breaking the app

---

# Project Identity

Project name:

**YWI HSE Safety System**

Project type:

**Supabase-backed HSE / safety compliance web application**

Main purpose:

Provide a lightweight web app for site safety workflows including:

- daily toolbox talks
- PPE compliance checks
- first aid kit checks
- site inspections
- emergency drills
- review workflows
- admin management of users, sites, and assignments

---

# Current Development Reality

The project is no longer best described as a simple `index.html + app.js` application.

It has been actively refactored into a more modular frontend while still remaining a static browser-based app.

Current frontend structure includes:

- `index.html`
- `style.css`
- `app.js`
- `js/bootstrap.js`
- `js/auth.js`
- `js/ui-auth.js`
- `js/admin-ui.js`
- `js/logbook-ui.js`
- `js/forms-toolbox.js`
- `js/forms-ppe.js`
- `js/forms-firstaid.js`
- `js/forms-inspection.js`
- `js/forms-drill.js`

This modular structure must be treated as the current direction of the project.

Do not collapse this work back into one oversized file unless explicitly asked.

---

# Current Frontend Responsibilities

## index.html

Contains the single-page app shell and all visible sections:

- `#toolbox`
- `#ppe`
- `#firstaid`
- `#inspect`
- `#drill`
- `#log`
- `#admin`

Also includes the auth UI shell and the small inline hash router used for section switching.

## app.js

Acts as the shared app shell.

Responsibilities include:

- app startup
- module initialization
- shared fetch helpers
- upload helpers
- outbox retry
- shared admin action wiring
- auth state reaction
- route-based admin auto-load support

## js/bootstrap.js

Responsible for:

- creating the Supabase client
- recovering auth sessions from callback URLs
- handling malformed callback cases
- exposing shared boot state/helpers

## js/auth.js

Shared auth controller.

Responsible for:

- auth state
- sign-in methods
- logout
- reset password flow
- session refresh
- syncing with bootstrap

## js/ui-auth.js

Auth UI controller.

Responsible for:

- login screen
- password/magic-link tabs
- login state rendering
- preventing the login screen from showing too early
- logout button behavior

## js/admin-ui.js

Admin Dashboard UI controller.

Responsible for:

- directory load/render
- summary cards
- mode switching
- row click-to-load behavior
- selector syncing
- admin role locking

## js/logbook-ui.js

Logbook/review/detail controller.

Responsible for:

- loading filtered submissions
- CSV export
- submission detail rendering
- review history rendering
- attached image rendering
- review panel actions

## js/forms-*.js modules

Each main form is split into its own module.

Current modules:

- Toolbox Talk
- PPE Check
- First Aid
- Site Inspection
- Emergency Drill

Each module is responsible for its own:

- row handling
- payload building
- signature behavior where needed
- optional image queue
- submit behavior
- outbox fallback

---

# Authentication Context

Authentication uses Supabase.

Current UI supports:

- magic link sign-in
- email + password sign-in
- password reset email flow
- logout

## Important recent auth issue

A major recent problem involved the magic link flow.

Symptom:

- user clicked the email link
- the app returned to the login screen
- URL sometimes contained both error data and valid auth tokens

Cause:

- auth callback hash data could be overwritten or read incorrectly too early
- the UI could render the logged-out screen before session recovery finished

Recent fixes focused on:

- preserving callback auth data
- not rewriting callback hashes too early
- manually recovering sessions from malformed URLs containing both error and token fragments
- delaying logged-out UI until auth recovery is finished

This area is sensitive.

If changing auth, do not casually remove these recovery protections.

---

# Current Roles

The current documentation direction and frontend role model uses these values:

- `worker`
- `staff`
- `onsite_admin`
- `job_admin`
- `site_leader`
- `supervisor`
- `hse`
- `admin`

## Role behavior direction

- `worker` = standard form access
- `staff` = operational access
- `onsite_admin` = elevated site-level access
- `job_admin` = elevated job/workflow access
- `site_leader`, `supervisor`, `hse` = review-capable roles
- `admin` = full admin dashboard access

Frontend review visibility is role-aware.

Frontend admin management is admin-locked.

Do not reduce the role list back to the older smaller set unless the backend/schema is intentionally being simplified.

---

# Supported Form Types

Current form codes:

- `A` = Emergency Drill
- `B` = First Aid Kit Check
- `C` = Site Inspection
- `D` = PPE Check
- `E` = Toolbox Talk

These values are already used across the app and documentation and should remain stable.

---

# Current Submission Status Values

- `submitted`
- `under_review`
- `approved`
- `follow_up_required`
- `closed`

Current review action values:

- `commented`
- `under_review`
- `approved`
- `follow_up_required`
- `closed`
- `reopened`

Do not rename these casually because they are shared across UI/backend/docs.

---

# Current Backend / Function Expectations

The frontend currently expects these Edge Functions:

- `resend-email`
- `clever-endpoint`
- `submission-detail`
- `review-submission`
- `admin-directory`
- `admin-manage`
- `admin-selectors`
- `upload-image`

Important note:

Older docs sometimes referred to `submission-images`, but current frontend work is aligned around `upload-image`.

When documenting or wiring code, stay consistent with the frontend actually being built.

---

# Current Database Expectations

Main tables:

- `profiles`
- `sites`
- `site_assignments`
- `submissions`
- `toolbox_attendees`
- `submission_reviews`
- `submission_images`

Storage bucket:

- `submission-images`

Expected image categories in current UI direction include:

- `general`
- `hazard`
- `status`
- `repair`
- `other`

---

# Admin Dashboard Context

This is the current active focus area.

The Admin Dashboard work is moving toward:

- cleaner summary cards
- better selector-driven editing
- easier row-to-form loading
- clearer separation of users / sites / assignments
- better role-based locking
- easier maintenance through `js/admin-ui.js`

If continuing development, Admin Dashboard UI is the primary place to resume unless told otherwise.

---

# Logbook Context

The logbook is not just a list.

Current intended features:

- filter by site
- filter by date range
- filter by form type
- filter by status
- export CSV
- load detail view
- render review history
- render images
- support review actions for allowed roles

The current code direction is to keep this in `js/logbook-ui.js` and not mix it back into unrelated form logic.

---

# Offline / Outbox Context

The app has an outbox concept for failed submissions.

When a form submission fails because of a server/network issue:

- payload is saved locally
- retry buttons can re-attempt queued submissions later

This should be preserved when refactoring form code.

---

# Routing Context

The app uses hash-based single-page navigation.

Current sections:

- `#toolbox`
- `#ppe`
- `#firstaid`
- `#inspect`
- `#drill`
- `#log`
- `#admin`

The router was updated so auth callback hashes do not break normal page routing.

This means auth-related hash handling is sensitive and should not be simplified carelessly.

---

# Development Rules For Future Sessions

When continuing this project, follow these practical rules:

1. Update one file at a time unless explicitly asked otherwise.
2. Provide the full contents of the file in a complete code block.
3. Keep existing IDs, selectors, routes, and naming stable unless there is a very good reason to change them.
4. Preserve the modular structure that now exists.
5. Do not remove auth recovery protections around magic links.
6. Do not assume docs are current unless they were updated after code changes.
7. Prefer extending existing modules over rebuilding the whole app structure.
8. Keep admin functionality aligned with the current dashboard direction.
9. When changing architecture, update the markdown docs too.

---

# Safe Continuation Starting Point

If resuming work in a new chat, the best startup instruction is:

“Read `AI_CONTEXT.md` and `PROJECT_BRAIN.md` first. Current focus: Admin Dashboard UI.”

That should be enough to re-establish the correct working context quickly.

---

# Current Priority

Current active priority:

**Admin Dashboard UI**

Secondary priorities:

- keep auth stable after magic-link hardening
- keep docs aligned with the modular frontend
- continue cleanup/refactor without breaking current flows

---

# Known Caution Areas

Sensitive areas that can break the app quickly:

- auth callback handling
- hash routing
- role names
- form type values
- submission status values
- Edge Function names
- upload flow naming
- shared DOM IDs used by current modules

---

# Related Documentation

Other key files that should stay aligned with this one:

- `README.md`
- `PROJECT_BRAIN.md`
- `PROJECT_STATE.md`
- `SYSTEM_ARCHITECTURE.md`
- `DATABASE_STRUCTURE.md`
- `REPO_BASE.md`
- `CHANGELOG.md`

---

# End of AI Context
