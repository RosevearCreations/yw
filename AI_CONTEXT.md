# AI Context

Read this first when continuing YWI HSE.

## Project state
The app is now a modular static frontend on top of Supabase.

## Active capabilities
- email/password sign-in plus magic link
- header session controls with name, settings, and logout
- employee self profile
- supervisor/admin crew visibility
- admin CRUD for profiles, sites, assignments
- safety form submission and review
- job and equipment planning scaffold

## User hierarchy direction
Each employee can have:
- default supervisor
- override supervisor
- default admin
- override admin
- start date
- employee number
- strengths

Supervisors should see their level and lower.
Admins should see all levels.

## New files this pass
- `js/jobs-ui.js`
- `sql/043_user_hierarchy_and_strengths.sql`
- `sql/044_jobs_equipment_and_reservations.sql`
- `sql/045_directory_views_and_scope_helpers.sql`
- `supabase/functions/jobs-directory/index.ts`
- `supabase/functions/jobs-manage/index.ts`

## Continue next with
- RLS and role visibility verification
- real equipment sign-out workflow
- job requirement to reservation conversion
