## 2026-04-05d session-integrity and logbook proxy pass
- Hardened session/profile application so stale async profile or boot responses can no longer overwrite a newer authenticated user after screen changes.
- Made logout deterministic by clearing local auth identity first, then completing remote sign-out without letting protected screen reloads rehydrate stale user fragments.
- Added stronger effective-role resolution using profile role, staff tier, and auth metadata so Admin/Supervisor identities are less likely to collapse back to employee semantics when legacy rows still exist.
- Added a same-origin `/api/logbook/review-list` proxy fallback and updated the frontend logbook loader to fall back there when the direct Supabase Edge Function path hits CORS/preflight failure.
- Reduced post-logout protected-fetch noise by ignoring profile/reference-data reload failures when logout or session removal is already in progress.

# YW Operations + HSE Platform

Last synchronized: April 7, 2026

## What this project is

This repository is the working build of a role-aware operations platform for a landscaping and field-services company with a connected HSE safety application.

The platform is being shaped to support three closely related business modes:

1. **Landscaping and grounds maintenance**
   - recurring lawn and property maintenance
   - seasonal cleanup
   - planting, mulching, pruning, edging, irrigation checks
   - snow or weather-related scheduling extensions if added later

2. **Project and construction-style work**
   - playground and splash pad work
   - park upgrades
   - light civil/site work
   - small building/construction support jobs
   - project-based estimates, work orders, materials, and costing

3. **Subcontract / equipment-and-operator dispatch work**
   - supplying an operator plus machine to another firm
   - equipment + driver assignments
   - contract and client-specific safety / site paperwork
   - time, billing, and cost tracking per assignment

The HSE side must also continue to work as a **standalone safety app** for unscheduled or one-off projects where the full operations workflow is not required.

## Core product direction

The product direction is now:
- mobile-first for field workers
- desktop-strong for office/admin users
- role-aware for Admin, Supervisor, and Employee users
- database-first for shared dropdowns, staff lists, equipment, jobs, and work orders
- strong validation and session integrity so one user's identity never cross-contaminates another user's view

## Admin backbone goals

The admin backbone is intended to become the single source of truth for:
- staff directory
- permissions and role assignment
- equipment catalog
- shared dropdown/reference values
- clients and sites
- estimates and work orders
- routes and crew assignments
- material usage and costing
- safety templates and required forms

## Current major modules

### 1) Auth and staff identity
- session-based login/logout
- onboarding completion
- profile and staff metadata
- password reset and admin password control
- staff roles: Admin / Supervisor / Employee

### 2) HSE / field safety
- toolbox talks
- PPE checks
- first aid kit checks
- site inspections
- emergency drills
- logbook and review flows

### 3) Operations and admin
- staff directory
- dropdown/catalog manager
- assignment workbench
- jobs and equipment workflows
- accounting stub and order scaffolding

## Planned operational depth

The next completed product shape should cover:
- estimates
- approved work orders
- job scheduling
- route planning
- crew assignment
- equipment reservations
- material planning and usage
- cost tracking
- subcontract dispatch tracking
- safety packet completion per job or per standalone HSE event

## Mobile-first expectations

Future builds should continue to assume that field users will often work from phones first.

That means:
- large touch targets
- short forms with progressive disclosure
- offline-safe drafts where practical
- camera/upload friendly job and safety flows
- clear empty states and save feedback
- minimal need to type repeated data already stored in the admin backbone

## Search and SEO direction

Public-facing pages should continue to be tuned for local search discovery, especially around the company service area.

Key rules:
- one H1 per exposed page
- keep admin/auth/private pages noindex
- continue route-by-route title and metadata cleanup
- continue local-service wording for the relevant municipalities/regions
- avoid letting internal admin shells leak into indexed pages

## Current priority order

1. finish session/auth integrity so identity never crosses between users
2. complete the admin backbone for staff, dropdowns, equipment, jobs, and work orders
3. deepen the landscaping/construction/subcontract data model
4. keep the HSE app usable both standalone and linked to operations
5. continue mobile-first UX hardening and CSS drift correction
6. keep docs and schema notes synchronized every pass
