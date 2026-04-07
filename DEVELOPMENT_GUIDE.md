# Development Guide

Last synchronized: April 7, 2026

## Purpose of this guide

This guide now reflects the practical direction for the project as a landscaping-led field operations and HSE platform.

Use this guide as the working build instruction set for future passes.

## Guiding principles

1. **Session integrity before feature growth**
   - never allow one user's identity, role, or profile to overwrite another's view
   - all protected screens must trust the same resolved actor

2. **Database-first shared data**
   - staff, dropdowns, equipment, jobs, work order statuses, and materials should live in the database
   - JSON fallback should be transitional, not permanent, where shared operational data is involved

3. **Mobile-first field usability**
   - forms should work on phones first
   - reduce repeated typing
   - large controls, strong empty states, visible save feedback

4. **Desktop-strong admin depth**
   - admin users need denser views for staffing, approvals, costing, equipment, and planning

5. **Standalone HSE support must remain**
   - safety workflows must still work for unscheduled or ad hoc projects where no full job record exists yet

## Product tracks

### Track 1 — Session and security completion
Complete these before calling the admin shell production-ready:
- deterministic login/logout
- no stale async identity overwrites
- consistent role resolution across frontend and Edge Functions
- tighter validation for profile and staff updates
- explicit stop of protected fetches during logout/session removal

### Track 2 — Admin backbone completion
Admin should become the source of truth for:
- staff directory
- role and employment status
- supervisor relationships
- dropdowns and shared catalogs
- equipment listings
- jobs and work orders
- route/service references
- materials and costing categories

### Track 3 — Landscaping operations model
Deepen the model for recurring and seasonal work:
- estimate
- approved work order
- scheduled visit / route stop
- crew assignment
- material allocation
- completion notes and client signoff
- recurring service templates

### Track 4 — Project / construction jobs
Support one-off and construction-style work:
- project estimate and scope
- phases / milestones
- work order packets
- site-specific safety requirements
- equipment reservations
- material and subcontract cost tracking

### Track 5 — Subcontract dispatch model
Support sending staff/equipment to another company:
- subcontract client
- dispatch date/time
- operator + equipment pairing
- time entry and billing basis
- client-specific safety or paperwork

### Track 6 — HSE standalone + linked mode
The HSE app must support both:
- standalone field use
- linked use attached to jobs, sites, work orders, or crews

## Recommended data priorities

Move these from fragmented JSON/fallback use toward shared DB-first structures where not already done:
- equipment master list
- staff lists
- job types
- work order statuses
- materials catalog
- unit types
- route/service areas
- recurring visit templates
- incident / inspection / safety categories

## Admin UI expectations

Admin should eventually include:
- staff management
- dropdown manager
- equipment manager
- jobs/work orders board
- approvals queue
- costing/materials manager
- client/site manager
- route planner
- audit and validation tools

## Mobile feature recommendations

Future mobile-friendly additions should include:
- camera-first uploads for field evidence
- quick action cards for start/pause/complete job
- route-stop check-in/out
- weather delay / site blocked quick actions
- barcode or QR equipment lookup later
- offline draft queue for forms and notes
- location stamp option for field forms when appropriate

## Validation and security rules

- every protected endpoint must fail clearly with the right auth/role response
- do not let compatibility fallbacks become the primary access path
- always prefer one canonical role-aware route over duplicates
- require visible success/error feedback on save paths
- do not let partial settings/profile data remain on screen after logout

## Definition of a successful next stage

The next interface stage should only begin when the following are true:
- no account cross-contamination remains
- admin role holds across navigation
- logout works repeatedly
- standalone HSE use still works
- admin can reliably manage staff, dropdowns, equipment, and jobs
- docs and schema notes are synchronized
