# CHANGELOG.md
# YWI HSE Safety System — Change Log

This file records meaningful project changes so the team can track what was changed, why it changed, and what direction the system is taking.

Dates can be updated later if you want exact commit dates added from Git history.

---

# Unreleased / Current Working State

## Documentation sync

Updated the main markdown files so they now reflect the real current state of the project instead of the older mostly-single-file frontend description.

Updated documentation files:

- `README.md`
- `AI_CONTEXT.md`
- `PROJECT_BRAIN.md`
- `PROJECT_STATE.md`
- `SYSTEM_ARCHITECTURE.md`
- `DATABASE_STRUCTURE.md`
- `REPO_BASE.md`
- `CHANGELOG.md`

Documentation now reflects:

- modular frontend structure
- current auth flow and hardening work
- current Admin Dashboard UI direction
- current role model
- current status/review values
- current Edge Function expectations
- current database/storage direction

---

## Frontend architecture refactor

Refactored the frontend away from a mostly centralized `app.js` flow into smaller browser modules.

Current modular structure now includes:

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

This changed the frontend from a harder-to-maintain structure into a clearer module-based layout.

### Result

- better separation of responsibilities
- easier one-file-at-a-time updates
- simpler future maintenance
- clearer continuation path for future chats/sessions

---

## Authentication hardening

Improved the authentication flow, especially around email magic links.

### Problems addressed

Earlier behavior could:

- return the user to the login screen after clicking a valid magic link
- mishandle callback URLs containing both error fragments and valid token fragments
- show the logged-out state too early before session recovery finished

### Changes made

- preserved auth callback data longer
- avoided overwriting auth callback hashes too early
- added session recovery logic for malformed callback URLs
- delayed logged-out UI until auth recovery completes
- introduced clearer separation between bootstrap/session recovery and auth UI rendering
- kept support for:
  - magic link sign-in
  - email + password sign-in UI
  - password reset email flow
  - logout

### Result

- safer callback handling
- more reliable sign-in recovery
- cleaner auth UI behavior

---

## App shell cleanup

Cleaned `app.js` so it now acts mainly as a shared app shell rather than a monolithic feature file.

### Current `app.js` responsibilities

- startup
- auth reaction
- shared fetch helpers
- upload helpers
- outbox retry
- module initialization
- shared admin action wiring
- route-aware admin loading

### Result

- fewer oversized mixed-responsibility scripts
- easier maintenance
- clearer feature ownership in modules

---

## Form modularization

Separated major form logic into dedicated files.

### Modules created / used

- `js/forms-toolbox.js`
- `js/forms-ppe.js`
- `js/forms-firstaid.js`
- `js/forms-inspection.js`
- `js/forms-drill.js`

### Form coverage

- Toolbox Talk
- PPE Check
- First Aid Kit Check
- Site Inspection
- Emergency Drill

### Result

Each form now owns its own:

- row handling
- payload building
- optional image queue
- signature behavior where needed
- submit flow
- outbox fallback

This makes future feature updates much safer.

---

## Admin Dashboard UI direction

Moved the Admin Dashboard into its own dedicated module and continued shaping it as the primary active feature area.

### Current admin direction includes

- summary cards
- users/sites/assignments views
- mode switching
- search/filter support
- selector syncing
- click-to-load row behavior
- admin role locking
- dedicated admin module structure

### Main file

- `js/admin-ui.js`

### Result

Admin work is now much easier to continue without tangling it with unrelated form code.

---

## Logbook and review modularization

Separated logbook/detail/review behavior into its own module.

### Current capabilities

- filter submission rows
- export CSV
- load submission detail
- render review history
- render attached images
- use review panel for eligible roles

### Main file

- `js/logbook-ui.js`

### Result

The logbook is now a cleaner feature area with less dependency on unrelated page logic.

---

## Routing cleanup

Cleaned the single-page hash routing behavior in `index.html`.

### Improvements

- section routing remains lightweight
- auth callback hashes are protected from normal page routing
- navigation state and visible section state stay aligned
- section routing no longer interferes with auth recovery behavior

### Result

Safer interaction between app routing and auth callbacks.

---

## Current active role model

Confirmed and documented the current project role direction as:

- `worker`
- `staff`
- `onsite_admin`
- `job_admin`
- `site_leader`
- `supervisor`
- `hse`
- `admin`

### Result

Docs and frontend direction are now aligned on the broader role model.

---

## Current status/review values

Confirmed and documented the current workflow values.

### Submission status values

- `submitted`
- `under_review`
- `approved`
- `follow_up_required`
- `closed`

### Review action values

- `commented`
- `under_review`
- `approved`
- `follow_up_required`
- `closed`
- `reopened`

### Result

These values are now documented consistently across the current docs set.

---

## Current function naming direction

Aligned docs to the current frontend expectation for Edge Functions.

### Current expected functions

- `resend-email`
- `clever-endpoint`
- `submission-detail`
- `review-submission`
- `admin-directory`
- `admin-manage`
- `admin-selectors`
- `upload-image`

### Note

Older documentation sometimes referenced `submission-images`, but the current frontend direction is aligned around `upload-image`.

---

## Current data/storage direction

Confirmed and documented the current data model direction.

### Main tables

- `profiles`
- `sites`
- `site_assignments`
- `submissions`
- `toolbox_attendees`
- `submission_reviews`
- `submission_images`

### Storage bucket

- `submission-images`

### Result

The docs now reflect the data model the frontend is actually expecting.

---

# Next Planned Work

The main current focus remains:

## Admin Dashboard UI

Continue improving:

- layout clarity
- selector workflows
- editing usability
- role-aware behaviors
- data loading consistency

Secondary priority areas:

- verify deployed auth redirect configuration
- verify current frontend against deployed Edge Functions
- keep docs synchronized with architecture changes
- continue careful cleanup without breaking working flows

---

# Notes For Future Updates

When future changes are made, add entries for:

- auth behavior changes
- role/status/value changes
- database schema changes
- Edge Function renames
- admin dashboard changes
- logbook/review changes
- major UI restructures
- deployment-affecting fixes

---

# End of Change Log
