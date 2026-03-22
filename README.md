# YWI HSE Safety System

YWI HSE is a modular Supabase-backed safety and workforce management app for a construction-type company.

## Current direction

The app now combines:
- authentication with magic link and password login
- in-app password creation/change and log out everywhere
- tiered visibility for employees, supervisors, and admins
- safety forms and image evidence
- logbook review workflows
- admin directory and profile management
- richer employee records for construction operations

## Current frontend modules

- `js/bootstrap.js` — Supabase bootstrap and callback recovery
- `js/auth.js` — shared auth controller
- `js/ui-auth.js` — sign-in UI
- `js/account-ui.js` — password and session security UI
- `js/security.js` — role/tier and route guard rules
- `js/router.js` — guarded hash routing
- `js/api.js` — API and upload helpers
- `js/outbox.js` — failed submission queue and retry
- `js/admin-ui.js` — admin directory UI
- `js/admin-actions.js` — admin CRUD actions
- `js/logbook-ui.js` — logbook, detail, and review UI
- `js/forms-*.js` — per-form modules
- `app.js` — shared app shell and module initialization

## Tier model

- `worker` and `staff` see their own working screens
- `site_leader`, `supervisor`, `hse`, and `job_admin` can review and can open the admin directory in read-only mode where allowed
- `admin` can manage profiles, sites, assignments, and see all tiers

## Richer workforce profile fields

The project direction now includes profile data such as:
- address
- phone and verified phone
- email and verified email direction
- emergency contact
- current position
- years employed
- previous employee flag
- trade/specialty
- certifications/tickets
- vehicle and plate
- feature preferences
- general construction/company notes

## Important note

Frontend tiering improves usability, but true security must still be enforced in Supabase Edge Functions and SQL/RLS.
