# System Architecture

## Frontend
Static modular SPA.

Key modules now include auth, security, profile, admin, jobs, equipment, logbook, and form modules.

## Backend
Supabase Auth, Postgres, Storage, Edge Functions.

## New backend scope in this pass
- hierarchy fields on `profiles`
- richer `sites` metadata
- `jobs`
- `equipment_items`
- `job_equipment_requirements`
- `equipment_signouts`
- `v_people_directory`
- `v_jobs_directory`
- `v_equipment_directory`

## New Edge Functions in this pass
- `jobs-directory`
- `jobs-manage`

Updated functions:
- `reference-data`
- `admin-manage`
- `admin-selectors`


## Latest security and workflow pass

This pass adds password/account maintenance improvements, email verification resend, phone verification request workflow, direct-report crew filtering, equipment checkout/return workflow, reservation enforcement hooks, and a refreshed full schema reference. New backend pieces include `supabase/functions/account-maintenance`, expanded `jobs-manage`, expanded `jobs-directory`, and updated `admin-directory`. New SQL references include `046_account_validation_and_notifications.sql` and `047_password_validation_equipment_workflow.sql`.
