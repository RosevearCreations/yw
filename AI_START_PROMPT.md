# AI Start Prompt

Read `AI_CONTEXT.md` and `PROJECT_BRAIN.md` first.

Current focus:
- secure login/logout and password setup after magic-link sign-in
- employee/supervisor/admin workforce records
- route/view guards
- modular cleanup (`admin-actions.js`, `outbox.js`, guarded router)
- keep all markdown files updated to match the latest code

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
