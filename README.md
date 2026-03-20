# YWI HSE Safety System

YWI HSE is a Supabase-backed safety and compliance web app for field and site operations.

It supports authenticated staff, structured daily forms, review workflows, image evidence, logbook lookup/export, and admin management for profiles, sites, and assignments.

---

# Current System Status

The system is in an active functional build stage.

Core flows now exist for:

- authentication
- form submission
- image upload
- review workflow
- submission detail
- admin directory and management

The frontend has recently been reorganized from a mostly single-file script into a modular browser app structure.

---

# System Overview

The YWI HSE system currently provides:

- secure user authentication with Supabase
- magic link sign-in
- email + password sign-in UI
- password reset email flow
- structured digital safety forms
- image uploads for inspections, drills, and other supported evidence flows
- submission review and approval workflow
- logbook lookup and CSV export
- admin management of users, sites, and assignments
- offline/outbox retry support for failed submissions

The architecture keeps the frontend lightweight while moving secure logic to Supabase Edge Functions.

---

# Technology Stack

## Frontend

- HTML
- CSS
- Vanilla JavaScript
- Progressive Web App support

## Backend

- Supabase Auth
- Supabase Postgres
- Supabase Edge Functions
- Supabase Storage

## Deployment

- Static hosting (Vercel / Cloudflare Pages / Netlify)
- Supabase backend

---

# Current Frontend Architecture

The frontend is no longer documented accurately as just `index.html + app.js`.

Current main files:

- `index.html` — single-page app shell and all major sections
- `style.css` — layout and visual styling
- `app.js` — shared app shell, startup, upload helpers, outbox retry, admin action wiring
- `js/bootstrap.js` — Supabase bootstrap and callback/session recovery
- `js/auth.js` — shared authentication controller
- `js/ui-auth.js` — auth UI and login/logout state control
- `js/admin-ui.js` — Admin Dashboard UI controller
- `js/logbook-ui.js` — logbook, detail viewer, CSV export, and review UI
- `js/forms-toolbox.js` — Toolbox Talk form module
- `js/forms-ppe.js` — PPE Check form module
- `js/forms-firstaid.js` — First Aid Kit form module
- `js/forms-inspection.js` — Site Inspection form module
- `js/forms-drill.js` — Emergency Drill form module
- `manifest.json` — PWA metadata
- `server-worker.js` — service worker

This modular split is important and should be preserved in future updates.

---

# Core System Workflow

1. User signs in.
2. User fills out one of the supported safety forms.
3. Submission is stored in the database.
4. Optional images are uploaded and linked to the submission.
5. Supervisors, HSE staff, or other permitted roles review the submission.
6. Review actions update submission status and notes.
7. Admin users manage profiles, sites, and assignments through the admin dashboard.

---

# Supported Safety Forms

The system currently supports five safety form types.

## Toolbox Talk

Used for documenting safety meetings.

Includes:

- site
- date
- submitted by
- topic / notes
- attendee sign-in rows
- optional images

Form code: `E`

---

## PPE Check

Used to verify workers are wearing required protective equipment.

Includes:

- site
- date
- checked by
- worker roster
- PPE compliance values

Form code: `D`

---

## First Aid Kit Check

Ensures site medical kits are stocked.

Includes:

- site
- date
- checked by
- item checklist
- quantity / minimum / expiry checks
- flagged issue support

Form code: `B`

---

## Site Inspection

Full site hazard inspection.

Includes:

- site
- date
- inspector
- roster
- hazard list
- open hazard tracking
- approver
- signature
- image evidence

Form code: `C`

---

## Emergency Drill

Records evacuation or safety drills.

Includes:

- site
- date
- supervisor
- drill type
- start and end time
- participants
- evaluation
- follow-up actions
- next drill date
- issues flag
- signature
- image evidence

Form code: `A`

---

# Authentication

Authentication uses Supabase.

Current frontend support includes:

- magic link sign-in
- email + password sign-in UI
- password reset email flow
- logout
- session refresh handling

## Important recent auth work

Recent frontend changes hardened the login flow so the app can recover correctly from problematic callback URLs.

The frontend now:

- preserves auth callback data long enough for Supabase to process it
- avoids overwriting callback hashes too early
- recovers sessions from malformed callback URLs containing both error and token fragments
- delays showing the logged-out UI until auth recovery is complete

This work was done to fix cases where a valid email sign-in link could still return the user to the login screen.

---

# User Roles

Roles control access to features.

Current role values used by the frontend/backend documentation set:

- `worker`
- `staff`
- `onsite_admin`
- `job_admin`
- `site_leader`
- `supervisor`
- `hse`
- `admin`

### Worker

- submit forms
- use standard form flows

### Staff

- operational access as assigned

### Onsite Admin

- elevated site-level access

### Job Admin

- elevated job/workflow access

### Site Leader / Supervisor / HSE

- review submissions
- comment on reports
- change statuses where permitted

### Admin

- full access
- manage users
- manage sites
- manage assignments
- use admin dashboard tools

---

# Submission Status Flow

Submissions move through the following status states:

- `submitted`
- `under_review`
- `approved`
- `follow_up_required`
- `closed`

Review actions can move a submission between these states.

Current review action values:

- `commented`
- `under_review`
- `approved`
- `follow_up_required`
- `closed`
- `reopened`

---

# Database Structure

Main tables used by the system:

- `profiles`
- `sites`
- `site_assignments`
- `submissions`
- `toolbox_attendees`
- `submission_reviews`
- `submission_images`

See `DATABASE_STRUCTURE.md` for the more complete table and column reference.

---

# Storage

Images are stored in Supabase Storage.

Bucket:

- `submission-images`

Typical upload paths:

- `inspection/<submission_id>/<filename>`
- `drill/<submission_id>/<filename>`

Image metadata is stored in `submission_images`.

---

# Edge Functions

Edge Functions act as the secure backend API.

Current functions expected by the project docs and frontend/backend flow:

| Function | Purpose |
|---|---|
| `resend-email` | Submission intake + notification routing |
| `clever-endpoint` | Logbook query endpoint |
| `submission-detail` | Fetch one submission with reviews/images |
| `review-submission` | Add review actions and update status |
| `admin-directory` | Read users/sites/assignments |
| `admin-manage` | Create/update/delete admin records |
| `admin-selectors` | Selector/dropdown data for admin UI |
| `upload-image` | Image upload/registration flow used by the frontend |

All functions are expected to validate JWT tokens and check the user profile.

---

# Admin Dashboard

The current frontend focus is the Admin Dashboard UI.

Implemented direction includes:

- dashboard mode switching
- summary cards
- directory tables for users, sites, and assignments
- selector dropdown syncing
- click-to-load rows into editor forms
- role-based admin locking
- cleaner module separation through `js/admin-ui.js`

---

# Logbook and Review UI

The logbook flow now has its own UI module.

Capabilities include:

- filtered submission loading
- CSV export
- submission detail viewing
- review history display
- attached image rendering
- review panel for eligible roles

This logic now lives in `js/logbook-ui.js`.

---

# Offline / Retry Support

The frontend maintains an outbox for failed submissions.

If a submission fails because of a connection or server issue, the payload is stored locally and can be retried later through the retry buttons.

---

# Frontend Routing

The app is still a one-page application.

Primary sections / hashes:

- `#toolbox`
- `#ppe`
- `#firstaid`
- `#inspect`
- `#drill`
- `#log`
- `#admin`

Hash routing has been updated so auth callback hashes do not break normal section navigation.

---

# Deployment

## Frontend deployment

- Vercel
- Cloudflare Pages
- Netlify

## Backend

- Supabase project

## Important deployment checks

Before production deployment verify:

- correct Supabase URL and publishable key
- correct auth redirect URLs
- current Edge Functions deployed
- storage bucket and policies configured
- service worker not caching unsupported auth or POST flows

---

# Setup Notes

## Frontend

Set the correct Supabase project URL and publishable key in the frontend.

Never expose the service role key in browser code.

## Backend

Deploy the current Edge Functions and confirm any SQL migrations and storage configuration are applied.

---

# Testing Checklist

Before production deployment verify:

## Authentication

- magic link login works
- password UI behaves correctly
- reset password email flow works
- session persists across reloads
- callback recovery works after email sign-in

## Forms

- toolbox talk submits
- PPE check submits
- first aid check submits
- site inspection submits
- drill submits

## Uploads

- images upload successfully
- images appear in submission detail

## Review

- reviewers can change status
- review notes appear in history

## Admin

- profiles can be edited
- sites can be created and updated
- assignments can be created, updated, and deleted
- selector dropdowns populate correctly

## Logbook

- filters work
- CSV export works
- detail panel loads correctly

---

# Security Model

Security rules:

- frontend never uses service role keys
- Edge Functions validate user sessions
- role checks are performed through `profiles`
- image uploads are recorded in the database
- admin UI remains locked for non-admin users in the frontend
- review visibility is role-aware in the UI

---

# Documentation

Important repository documentation files:

- `README.md`
- `PROJECT_BRAIN.md`
- `AI_CONTEXT.md`
- `PROJECT_STATE.md`
- `SYSTEM_ARCHITECTURE.md`
- `DATABASE_STRUCTURE.md`
- `REPO_BASE.md`
- `CHANGELOG.md`

These documents should be kept aligned whenever architecture or workflow changes.

---

# Current Priority

Current active focus:

- Admin Dashboard UI
- keeping auth stable after magic-link changes
- keeping docs synchronized with the new modular frontend structure

---

# Immediate Next Steps

Recommended next steps:

- continue Admin Dashboard UI polish
- verify deployed auth redirect configuration
- verify `upload-image`, `admin-selectors`, and review flows against deployed backend versions
- continue reducing oversized inline/shared logic where useful
- keep markdown docs current as modules and flows evolve

---

# License

Internal company use.

---

# Maintainers

YWI HSE Development Team
