# System Architecture

## Frontend layers

- auth bootstrap and recovery
- auth UI and account security UI
- security and route guards
- API and outbox helpers
- admin UI and admin actions
- logbook/review UI
- form modules
- app shell

## Security model direction

Frontend now uses shared route and tier helpers so the app behaves consistently, but backend enforcement must validate:
- current user role
- current user active status
- site assignment access
- admin-only writes
- supervisor/HSE/job admin read limits

## Workforce model direction

The app is evolving from a simple safety app into a combined safety + workforce profile app for a construction company.

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


## Latest pass additions
- `js/reference-data.js` — populated reference lists for sites, supervisors, employees, positions, and trades
- `reference-data` Edge Function — scoped site/people/catalog reference data for form population
- `notify-admins` Edge Function — queues admin notifications when supervisor-level sign-off requires admin review
- `sql/040_reference_data_and_catalogs.sql` — catalog/reference tables and richer site metadata
- `sql/041_submission_notifications_and_signoff.sql` — sign-off fields and admin notification queue
- `sql/042_test_users_and_sites_seed.sql` — test profile/site seed data for login and assignment testing

Password login now exists as a first-class sign-in path so existing accounts can bypass magic link and sign in directly with email and password.
