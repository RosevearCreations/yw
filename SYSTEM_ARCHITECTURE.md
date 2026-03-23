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
