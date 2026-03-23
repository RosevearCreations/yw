# Deployment Guide

## Before deploy

1. deploy frontend files including new modules:
   - `js/admin-actions.js`
   - `js/outbox.js`
2. confirm `index.html` loads all modules in the correct order
3. deploy latest Supabase Edge Functions
4. apply latest SQL helpers and profile expansion SQL where appropriate
5. verify route/view restrictions and admin directory behavior with real accounts

## Security checks

- test worker login
- test supervisor login
- test admin login
- verify non-admin access to `#admin` is redirected
- verify frontend restrictions are matched by backend checks

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
