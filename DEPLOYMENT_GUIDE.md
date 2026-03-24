# Deployment Guide

## Apply SQL in order
Run the newest files after the older schema files:
- `043_user_hierarchy_and_strengths.sql`
- `044_jobs_equipment_and_reservations.sql`
- `045_directory_views_and_scope_helpers.sql`

## Deploy Edge Functions
Deploy or update:
- `reference-data`
- `admin-manage`
- `admin-selectors`
- `admin-directory`
- `jobs-directory`
- `jobs-manage`
- `resend-email`
- `review-submission`
- `submission-detail`
- `upload-image`

## Test after deploy
- password login
- header session controls
- self profile load/save
- crew visibility by role
- admin profile/site save
- jobs load/save
- equipment load/save


## Latest security and workflow pass

This pass adds password/account maintenance improvements, email verification resend, phone verification request workflow, direct-report crew filtering, equipment checkout/return workflow, reservation enforcement hooks, and a refreshed full schema reference. New backend pieces include `supabase/functions/account-maintenance`, expanded `jobs-manage`, expanded `jobs-directory`, and updated `admin-directory`. New SQL references include `046_account_validation_and_notifications.sql` and `047_password_validation_equipment_workflow.sql`.
