# Repo Base

## Current important files

### Shell and routing
- `index.html`
- `app.js`
- `style.css`
- `js/router.js`
- `js/security.js`

### Auth and account
- `js/bootstrap.js`
- `js/auth.js`
- `js/ui-auth.js`
- `js/account-ui.js`

### Shared helpers
- `js/api.js`
- `js/outbox.js`

### Admin and logbook
- `js/admin-ui.js`
- `js/admin-actions.js`
- `js/logbook-ui.js`

### Forms
- `js/forms-toolbox.js`
- `js/forms-ppe.js`
- `js/forms-firstaid.js`
- `js/forms-inspection.js`
- `js/forms-drill.js`

### SQL planning layer
- `sql/036_employee_profile_expansion.sql`
- `sql/037_security_rls_verification_notes.sql`

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
