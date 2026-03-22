# Database Structure

## Main tables
- `profiles`
- `sites`
- `site_assignments`
- `submissions`
- `toolbox_attendees`
- `submission_reviews`
- `submission_images`

## Expanded profiles direction

`profiles` now needs to support:
- `email`, `email_verified`
- `full_name`
- `role`, `is_active`
- `phone`, `phone_verified`
- `address_line1`, `address_line2`, `city`, `province`, `postal_code`
- `emergency_contact_name`, `emergency_contact_phone`
- `vehicle_make_model`, `vehicle_plate`
- `years_employed`
- `current_position`
- `previous_employee`
- `trade_specialty`
- `certifications`
- `feature_preferences`
- `notes`

## Role model
- `worker`
- `staff`
- `onsite_admin`
- `site_leader`
- `supervisor`
- `hse`
- `job_admin`
- `admin`

## Security helper SQL

Current helper direction is built around:
- `role_rank()`
- `profile_role_rank()`
- `site_assignment_role_rank()`
- `effective_site_role_rank()`
- `can_manage_site()`

See `sql/036_employee_profile_expansion.sql` and `sql/037_security_rls_verification_notes.sql` for the newest planning layer.

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
