# Database Structure

## Core tables
- `profiles`
- `sites`
- `site_assignments`
- `submissions`
- `submission_reviews`
- `submission_images`
- `toolbox_attendees`

## New hierarchy/profile columns
- `employee_number`
- `start_date`
- `strengths`
- `default_supervisor_profile_id`
- `override_supervisor_profile_id`
- `default_admin_profile_id`
- `override_admin_profile_id`

## New site columns
- `admin_profile_id`
- `site_supervisor_profile_id`
- `signing_supervisor_profile_id`
- `region`
- `client_name`
- `project_code`
- `project_status`

## New job/equipment tables
- `jobs`
- `equipment_items`
- `job_equipment_requirements`
- `equipment_signouts`

## New views
- `v_people_directory`
- `v_jobs_directory`
- `v_equipment_directory`
