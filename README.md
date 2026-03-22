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

---

## Latest Security and Backend Pass

This documentation has been updated to reflect the latest project pass.

New frontend/security work included:
- added `js/profile-ui.js`
- added employee self-profile screen (`#me`)
- added supervisor/admin crew view (`#crew`)
- added settings/session screen (`#settings`)
- improved session visibility, logout, and clear-session flow
- kept in-app password creation/change and logout-everywhere support
- expanded routing/security rules for worker, supervisor, HSE, job admin, and admin users
- continued splitting shared logic into dedicated modules

New backend/database work included:
- added `sql/038_profile_visibility_rls.sql`
- added `sql/039_directory_scope_helpers.sql`
- added detailed Edge Function examples for:
  - `supabase/functions/admin-manage/index.ts`
  - `supabase/functions/admin-directory/index.ts`
  - `supabase/functions/admin-selectors/index.ts`

Current people visibility direction:
- employees/workers see only their own profile and screens
- supervisors can view employee records and crew screens
- HSE and Job Admin can view broader non-admin crew data
- admins can view and manage employees, supervisors, and admins

Important note:
Frontend guards improve the UX, but real security must still be enforced by SQL, RLS, and Edge Functions.
