# DATABASE_STRUCTURE.md
# YWI HSE Safety System — Database Structure Reference

This document summarizes the current intended schema for the YWI HSE system. The SQL source of truth for the latest full reference is:

- `sql/000_full_schema_reference.sql`

## Core people and hierarchy

Main user table:
- `profiles`

Important profile fields include:
- identity: `id`, `email`, `full_name`, `role`, `is_active`
- contact: `phone`, `phone_verified`, `email_verified`
- address: `address_line1`, `address_line2`, `city`, `province`, `postal_code`
- employment: `employee_number`, `start_date`, `years_employed`, `current_position`, `previous_employee`
- construction-specific: `trade_specialty`, `strengths`, `certifications`, `vehicle_make_model`, `vehicle_plate`
- emergency: `emergency_contact_name`, `emergency_contact_phone`
- preferences: `feature_preferences`
- hierarchy: `default_supervisor_profile_id`, `override_supervisor_profile_id`, `default_admin_profile_id`, `override_admin_profile_id`

Supporting site relationship table:
- `site_assignments`

Important assignment fields include:
- `site_id`, `profile_id`, `assignment_role`, `is_primary`
- `reports_to_supervisor_profile_id`
- `reports_to_admin_profile_id`

## Sites

Main site table:
- `sites`

Important fields include:
- `site_code`, `site_name`, `address`
- `region`, `client_name`, `project_code`, `project_status`
- `site_supervisor_profile_id`
- `signing_supervisor_profile_id`
- `admin_profile_id`
- `notes`, `is_active`

## Safety submissions

Main operational tables:
- `submissions`
- `toolbox_attendees`
- `submission_reviews`
- `submission_images`

Submission records support:
- site and site id
- form type A–E
- supervisor/signing supervisor/admin sign-off references
- review status and payload JSON

## Jobs and equipment

Main planning and tracking tables:
- `jobs`
- `equipment_items`
- `job_equipment_requirements`
- `equipment_signouts`

These support:
- job creation and approval chain
- equipment reservation intent
- equipment checkout/return tracking
- linking equipment to current jobs and supervisors

## Notifications and validation workflow

Notification queue table:
- `admin_notifications`

Used for:
- supervisor sign-off notifications
- phone verification requests
- equipment checkout notifications
- equipment return notifications
- future approval workflows

## Reference catalogs

Reference tables include:
- `position_catalog`
- `trade_catalog`

These are used to populate admin/user forms and reduce free-text drift.

## Views expected by the frontend/backend

Directory and planning views:
- `v_people_directory`
- `v_assignments_directory`
- `v_jobs_directory`
- `v_equipment_directory`

## SQL migration set to review

Important SQL files now include:
- `030_profiles_sites_assignments.sql`
- `036_employee_profile_expansion.sql`
- `040_reference_data_and_catalogs.sql`
- `041_submission_notifications_and_signoff.sql`
- `043_user_hierarchy_and_strengths.sql`
- `044_jobs_equipment_and_reservations.sql`
- `045_directory_views_and_scope_helpers.sql`
- `046_account_validation_and_notifications.sql`
- `047_password_validation_equipment_workflow.sql`
- `000_full_schema_reference.sql`

## Current implementation note

The live project may still be catching up to the newest reference schema. If a SQL file fails because a column does not exist yet, compare the live database to `000_full_schema_reference.sql` and apply the missing migration steps in order.
