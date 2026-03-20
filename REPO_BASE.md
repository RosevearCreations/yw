# REPO_BASE.md
# YWI HSE Safety System — Repository Base Guide

This document explains the repository structure, file responsibilities, working conventions, and continuation rules for the YWI HSE Safety System.

It is meant to help anyone opening the repo quickly understand how the project is organized today.

---

# Repository Purpose

This repository contains the frontend and supporting project documentation for the YWI HSE Safety System.

The application is a static web frontend backed by Supabase services.

The repo is used for:

- frontend code
- app shell and UI modules
- form modules
- project documentation
- architecture references
- future maintenance and continuation

---

# Current Architectural Direction

The repository is no longer organized around a single large browser script.

The current direction is a **modular static frontend**.

That means:

- the HTML shell remains simple
- feature logic is split into dedicated JS files
- auth, admin, logbook, and forms are separated
- shared app startup and helpers live in `app.js`
- docs should be updated as architecture changes

This modular direction should be preserved.

---

# Current Main Files

## Root frontend files

- `index.html`
- `style.css`
- `app.js`

## JavaScript modules

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

## Support files

- `manifest.json`
- `server-worker.js`

## Core markdown documentation

- `README.md`
- `AI_CONTEXT.md`
- `PROJECT_BRAIN.md`
- `PROJECT_STATE.md`
- `SYSTEM_ARCHITECTURE.md`
- `DATABASE_STRUCTURE.md`
- `REPO_BASE.md`
- `CHANGELOG.md`

---

# Root File Responsibilities

## index.html

Contains the single-page app shell.

Includes:

- nav
- login/auth UI
- identity display
- all major app sections
- small inline hash-routing logic

Sections currently supported:

- `#toolbox`
- `#ppe`
- `#firstaid`
- `#inspect`
- `#drill`
- `#log`
- `#admin`

This file should remain the shell, not the place where most business logic is written.

---

## style.css

Contains application styling.

Current styling responsibilities include:

- layout
- cards
- forms
- tables
- admin dashboard visuals
- auth screen styling
- responsive adjustments

When possible, styling should stay here rather than in large inline style blocks.

---

## app.js

Acts as the shared app controller.

Current responsibilities:

- app startup
- auth reaction
- shared fetch helpers
- upload helpers
- outbox retry
- module initialization
- shared admin action wiring
- route-aware admin loading

`app.js` should stay focused on shared shell behavior and not become a monolithic feature file again.

---

# JavaScript Module Responsibilities

## js/bootstrap.js

Purpose:

- create shared Supabase client
- recover session from callback URLs
- handle malformed auth callback cases
- expose boot state/helpers

This file is important because the project recently required extra magic-link hardening.

---

## js/auth.js

Purpose:

- shared auth controller
- sign-in methods
- logout
- password reset
- session refresh
- auth state synchronization

---

## js/ui-auth.js

Purpose:

- auth UI rendering
- login/logout view control
- magic-link/password tab behavior
- auth notices
- loading state while auth is being restored

This file should remain the main place for login/logout UI behavior.

---

## js/admin-ui.js

Purpose:

- Admin Dashboard UI logic

Responsibilities:

- directory loading
- users/sites/assignments rendering
- summary cards
- mode switching
- selector syncing
- row click-to-load behavior
- admin access locking

This is one of the main active work areas.

---

## js/logbook-ui.js

Purpose:

- Logbook and review UI logic

Responsibilities:

- logbook filtering/loading
- CSV export
- detail rendering
- review history rendering
- attached image rendering
- review panel actions

This should remain separate from admin and form code.

---

## Form modules

Each safety form has its own module.

### js/forms-toolbox.js
Toolbox Talk form behavior

### js/forms-ppe.js
PPE Check form behavior

### js/forms-firstaid.js
First Aid Kit form behavior

### js/forms-inspection.js
Site Inspection form behavior

### js/forms-drill.js
Emergency Drill form behavior

Each form module is responsible for:

- dynamic rows
- payload building
- signature logic where needed
- optional image queue
- submit flow
- outbox fallback

---

# Support Files

## manifest.json

Used for PWA metadata.

## server-worker.js

Used for service worker behavior.

Be careful with service worker changes because auth and POST flows can be affected by caching behavior.

---

# Current Backend Expectations

The repo is frontend-first, but the code depends on specific Supabase Edge Functions.

Current expected function names:

- `resend-email`
- `clever-endpoint`
- `submission-detail`
- `review-submission`
- `admin-directory`
- `admin-manage`
- `admin-selectors`
- `upload-image`

If the backend function names change, the frontend docs and code must be updated together.

---

# Current Data Expectations

The frontend assumes these major tables exist:

- `profiles`
- `sites`
- `site_assignments`
- `submissions`
- `toolbox_attendees`
- `submission_reviews`
- `submission_images`

Storage bucket expected:

- `submission-images`

---

# Current Role Model

Current role values in active use/documentation direction:

- `worker`
- `staff`
- `onsite_admin`
- `job_admin`
- `site_leader`
- `supervisor`
- `hse`
- `admin`

These values appear in:

- auth state rendering
- admin locking
- review visibility
- documentation

Do not rename or collapse them casually.

---

# Current Status Model

Current submission statuses:

- `submitted`
- `under_review`
- `approved`
- `follow_up_required`
- `closed`

Current review actions:

- `commented`
- `under_review`
- `approved`
- `follow_up_required`
- `closed`
- `reopened`

These values are shared across modules and docs.

---

# Current Form Type Values

These must remain stable:

- `A` = Emergency Drill
- `B` = First Aid Kit Check
- `C` = Site Inspection
- `D` = PPE Check
- `E` = Toolbox Talk

---

# Current Development Focus

The current main focus is:

**Admin Dashboard UI**

That means future work should primarily continue in and around:

- `js/admin-ui.js`
- admin-related parts of `app.js`
- related docs

Secondary focus areas:

- keeping auth stable after callback recovery changes
- keeping docs synchronized with code
- continuing modular cleanup carefully

---

# Recent Important Changes

Recent important architecture/state changes include:

- frontend split into multiple JS modules
- logbook moved into its own module
- admin dashboard moved into its own module
- all major forms split into dedicated modules
- auth flow hardened for malformed callback URLs
- login UI updated to support password flow in addition to magic link UI
- app startup cleaned up around modular initialization

Older docs may still refer to earlier structure and should not be trusted unless updated recently.

---

# Safe Working Rules

When updating this repository, follow these rules.

## 1. Update one file at a time

Unless explicitly asked otherwise, changes should be delivered one full file at a time.

## 2. Preserve stable IDs/selectors

Many modules depend on existing DOM IDs and selectors.

## 3. Preserve current role values

Do not rename role values casually.

## 4. Preserve current status values

Do not rename status/review values casually.

## 5. Preserve current form type letters

These are shared constants across code and docs.

## 6. Do not simplify away auth recovery logic

The magic-link flow required hardening and should not be stripped down carelessly.

## 7. Keep docs in sync

When architecture changes, markdown docs must be updated too.

## 8. Prefer extending modules over rebuilding structure

The repo is already moving in the right direction structurally.

---

# Typical Working Pattern

A good development pattern for this repo is:

1. read `AI_CONTEXT.md`
2. read `PROJECT_BRAIN.md`
3. identify current focus
4. update one file at a time
5. keep docs aligned
6. verify auth/admin/logbook assumptions after structural changes

---

# Suggested Start Prompt For Future Sessions

Use this when continuing later:

**Read `AI_CONTEXT.md` and `PROJECT_BRAIN.md` first. Current focus: Admin Dashboard UI.**

That is the fastest way to restore correct context.

---

# Known Sensitive Areas

Be careful when editing:

- auth callback handling
- hash routing
- role values
- form type values
- status values
- Edge Function names
- upload flow naming
- shared DOM IDs
- selector IDs used by admin and logbook modules

These are the places most likely to create cross-feature breakage.

---

# Documentation Maintenance Rule

The following files should stay aligned:

- `README.md`
- `AI_CONTEXT.md`
- `PROJECT_BRAIN.md`
- `PROJECT_STATE.md`
- `SYSTEM_ARCHITECTURE.md`
- `DATABASE_STRUCTURE.md`
- `REPO_BASE.md`
- `CHANGELOG.md`

If code changes the architecture, these docs should be checked.

---

# Repository Summary

This repository currently represents:

- a modular static frontend
- Supabase-backed authentication and data flows
- structured form modules
- a growing Admin Dashboard
- a separate logbook/review module
- a project that is actively being cleaned and stabilized

The most important working principle is:

**continue improving maintainability without undoing the modular structure or the recent auth hardening**

---

# End of Repository Base Guide
