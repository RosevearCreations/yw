# PROJECT_STATE.md
# YWI HSE Safety System — Development State Snapshot

This document records the **current development state of the YWI HSE system** so new developers or AI assistants can immediately understand where the project stands.

It should be updated whenever major architecture or feature changes occur.

---------------------------------------------------------------------

# Current Project Phase

The system is currently in the **active functional development and refactor stage**.

Core features are present and working in principle, but the frontend is in the middle of a structured cleanup and modularization pass.

The backend architecture, authentication foundation, database structure, storage usage, and Edge Function pattern are established.

The current work is focused on improving maintainability, stabilizing authentication, and continuing the Admin Dashboard UI.

---------------------------------------------------------------------

# What Is Currently Working

## Authentication

Supabase authentication is implemented in the frontend.

Current supported auth UI flows:

- magic link sign-in
- email + password sign-in UI
- password reset email flow
- logout
- session refresh handling

Recent frontend work has improved magic-link callback handling and session recovery.

This includes protection against malformed callback URLs that may contain both error fragments and valid auth tokens.

---------------------------------------------------------------------

## Safety Forms

Five safety form types are implemented.

### Toolbox Talk (Form E)

Records safety meeting discussions.

Includes:

- site
- date
- submitted by
- topic notes
- attendee list
- optional images

Attendees are stored through the toolbox attendee flow.

---------------------------------------------------------------------

### PPE Check (Form D)

Checks worker PPE compliance.

Includes:

- site
- date
- checked by
- worker roster
- PPE compliance checks

---------------------------------------------------------------------

### First Aid Kit Check (Form B)

Tracks first aid kit readiness.

Includes:

- site
- date
- checked by
- stock rows
- minimum stock checks
- expiry tracking

---------------------------------------------------------------------

### Site Inspection (Form C)

Records inspection and hazard information.

Includes:

- site
- date
- inspector
- worker roster
- hazards
- approval signature
- optional image uploads

---------------------------------------------------------------------

### Emergency Drill (Form A)

Records safety drill activity.

Includes:

- site
- date
- supervisor
- drill type
- drill timing
- participants
- evaluation
- follow-up actions
- next drill date
- issue flag
- supervisor signature
- optional image uploads

---------------------------------------------------------------------

# Image Upload System

Image uploads are part of the active working flow.

Images are stored in Supabase Storage.

Bucket:

`submission-images`

Image metadata is stored in:

`submission_images`

Typical current storage path patterns include:

- `inspection/<submission_id>/<filename>`
- `drill/<submission_id>/<filename>`

The frontend currently uses an `upload-image` function path in its upload flow.

---------------------------------------------------------------------

# Logbook System

The logbook interface allows users to:

- view recent safety submissions
- filter by site
- filter by form type
- filter by date range
- filter by status
- export rows to CSV
- open full submission detail
- review attached images
- review status history

The logbook/review/detail UI has been separated into its own module.

---------------------------------------------------------------------

# Review System

The review system is implemented.

Eligible roles can:

- open submission detail
- add review notes
- change submission status
- update admin notes
- inspect review history

Review actions are stored in:

`submission_reviews`

Submission status and notes are updated in:

`submissions`

---------------------------------------------------------------------

# Admin System

Admin features exist and are functional at the frontend/backend pattern level.

Admin users can:

- view profiles
- edit user roles
- edit user active state
- create sites
- update sites
- create assignments
- update assignments
- delete assignments

Admin workflows currently use:

- `admin-directory`
- `admin-manage`
- `admin-selectors`

The Admin Dashboard is the current main UI focus.

---------------------------------------------------------------------

# Current Frontend Architecture Status

The frontend has been refactored away from a mostly single-file structure.

## Current structure

Main app shell:

- `index.html`
- `style.css`
- `app.js`

Auth/app boot layer:

- `js/bootstrap.js`
- `js/auth.js`
- `js/ui-auth.js`

Feature UI modules:

- `js/admin-ui.js`
- `js/logbook-ui.js`

Form modules:

- `js/forms-toolbox.js`
- `js/forms-ppe.js`
- `js/forms-firstaid.js`
- `js/forms-inspection.js`
- `js/forms-drill.js`

Support files:

- `manifest.json`
- `server-worker.js`

This modular architecture is now the current direction and should be treated as the active frontend design.

---------------------------------------------------------------------

# Edge Functions Currently Expected

The frontend currently expects these Edge Functions:

## resend-email

Handles form submissions.

Responsibilities:

- validate user session
- create submission records
- insert additional row data where needed
- trigger email/notification flow where applicable

---------------------------------------------------------------------

## clever-endpoint

Handles logbook queries.

Responsibilities:

- validate JWT
- filter submissions
- return logbook rows

---------------------------------------------------------------------

## upload-image

Handles image upload/registration flow used by the frontend.

Responsibilities:

- validate authenticated user
- verify submission exists
- register or process image upload metadata

---------------------------------------------------------------------

## submission-detail

Returns a full submission record.

Includes:

- payload
- review history
- image list

---------------------------------------------------------------------

## review-submission

Handles review actions.

Responsibilities:

- record review history
- update submission status
- update admin notes

---------------------------------------------------------------------

## admin-directory

Returns:

- profiles
- sites
- assignments

---------------------------------------------------------------------

## admin-manage

Handles admin updates.

Allows:

- edit profiles
- create/update sites
- create/update/delete assignments

---------------------------------------------------------------------

## admin-selectors

Returns selector/dropdown data for the admin dashboard.

Used for:

- profile selectors
- site selectors
- assignment selectors

---------------------------------------------------------------------

# Database Schema Status

The following tables are expected and used by the application:

- `profiles`
- `sites`
- `site_assignments`
- `submissions`
- `toolbox_attendees`
- `submission_reviews`
- `submission_images`

Schema documentation should remain aligned with `DATABASE_STRUCTURE.md`.

---------------------------------------------------------------------

# Security Model

## Authentication

Supabase session-based authentication.

## Authorization

Role validation is based on the `profiles` table and current user role.

## Frontend behavior

- admin management is locked in the UI for non-admin users
- review UI is hidden for lower roles
- auth recovery waits before displaying a logged-out state

## Backend expectation

Secure validation belongs in Edge Functions, not the browser.

Service role keys must remain backend-only.

---------------------------------------------------------------------

# Current Roles

Current role values in active use/documentation direction:

- `worker`
- `staff`
- `onsite_admin`
- `job_admin`
- `site_leader`
- `supervisor`
- `hse`
- `admin`

These are broader than the older role list and reflect the current UI/security direction.

---------------------------------------------------------------------

# Current Submission Status Values

Current status values:

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

---------------------------------------------------------------------

# Known Important Changes Since Earlier Docs

Older project docs often described the frontend as mostly:

- `index.html`
- `app.js`
- `style.css`

That is no longer an accurate description.

Older docs also often described auth primarily as simple magic link only.

That is also no longer complete.

The current codebase includes:

- modular JS files
- explicit auth UI separation
- stronger callback/session recovery logic
- separate admin and logbook modules
- separate form modules

---------------------------------------------------------------------

# Known Minor / Ongoing Issues

These are current areas to keep watching:

- deployed auth redirect configuration may still need verification
- service worker behavior should be checked to ensure it does not interfere with auth or POST flows
- docs may lag behind code unless updated after each architecture change
- backend deployment/version alignment should be checked against the current frontend assumptions
- assignment-based site restrictions are not yet the final completed model across the whole system

---------------------------------------------------------------------

# Major Architecture Status

Architecture is **stable enough to continue building on**, but the frontend is still actively being cleaned and organized.

Key strengths now include:

- clearer module separation
- auth handling isolated into dedicated files
- form logic separated by feature
- admin and logbook logic separated from general app shell
- static frontend with Supabase-backed secure services
- ability to continue scaling features without growing one monolithic script

---------------------------------------------------------------------

# Immediate Next Priorities

Recommended next steps.

## 1. Continue Admin Dashboard UI work

This is the main active focus.

Includes:

- polish layout
- improve selector flow
- improve usability
- verify data-loading behavior
- continue keeping admin logic inside `js/admin-ui.js`

## 2. Verify auth end-to-end in deployment

Includes:

- magic link
- password sign-in UI behavior
- reset flow
- callback/session recovery
- redirect configuration

## 3. Keep docs aligned with the modular frontend

Several docs previously drifted behind the actual code.

## 4. Verify frontend assumptions against deployed Edge Functions

Especially:

- `upload-image`
- `admin-selectors`
- `review-submission`
- `submission-detail`

## 5. Continue cleanup without breaking current flows

Refactoring should preserve:

- DOM IDs
- route hashes
- role values
- form codes
- submission status values

---------------------------------------------------------------------

# Medium-Term Improvements

Planned or recommended enhancements:

- assignment-based site restrictions throughout UI/backend
- better admin usability
- improved image evidence gallery tools
- print/PDF export support
- better audit trail visibility
- improved status/reopen flows
- stronger RLS verification
- service worker cleanup if needed

---------------------------------------------------------------------

# Long-Term Improvements

Possible future capabilities:

- multi-company support
- advanced dashboard analytics
- automated reminders / overdue follow-up tracking
- PDF safety reports
- mobile-first refinement
- deeper site-based permission controls

---------------------------------------------------------------------

# Deployment Status

## Frontend

Static deployment supported.

Examples:

- Vercel
- Cloudflare Pages
- Netlify

## Backend

Supabase project

---------------------------------------------------------------------

# Documentation Files

Important documentation:

- `README.md`
- `PROJECT_BRAIN.md`
- `AI_CONTEXT.md`
- `SYSTEM_ARCHITECTURE.md`
- `PROJECT_STATE.md`
- `DATABASE_STRUCTURE.md`
- `REPO_BASE.md`
- `CHANGELOG.md`

These files should be updated whenever architecture, auth, or workflow design changes.

---------------------------------------------------------------------

# How To Start Development In A New Chat

Paste or ask the assistant to read first:

- `AI_CONTEXT.md`
- `PROJECT_BRAIN.md`

Then continue with a focused instruction.

Recommended example:

“Read `AI_CONTEXT.md` and `PROJECT_BRAIN.md` first. Current focus: Admin Dashboard UI.”

---------------------------------------------------------------------

# End Of Project State Snapshot
