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


## Latest security and workflow pass

This pass adds password/account maintenance improvements, email verification resend, phone verification request workflow, direct-report crew filtering, equipment checkout/return workflow, reservation enforcement hooks, and a refreshed full schema reference. New backend pieces include `supabase/functions/account-maintenance`, expanded `jobs-manage`, expanded `jobs-directory`, and updated `admin-directory`. New SQL references include `046_account_validation_and_notifications.sql` and `047_password_validation_equipment_workflow.sql`.

---

## Reservation / Approval / Verification Pass (March 24, 2026)

This pass updates the repo toward the next high-value workflow layer:
- equipment reservations now support pool-aware conflict checking instead of single-item-only assumptions
- admin notifications now support approval decision fields and email delivery tracking
- jobs gain approval tracking fields
- job equipment requirements gain pool keys and approval tracking fields
- optional Twilio Verify SMS phone verification flow is scaffolded in `account-maintenance`

### New migration
- `sql/048_notification_approvals_reservation_pools_and_sms.sql`

### Updated backend behavior
- `jobs-manage` now checks overlapping jobs and counts free assets inside a pool before reserving
- `jobs-directory` now returns pool availability plus recent job/equipment notifications
- `admin-directory` now returns notifications in `all` / `notifications` scope
- `admin-manage` now supports notification actions: `mark_read`, `approve`, `reject`, `resolve`, `dismiss`
- `account-maintenance` now supports optional SMS actions: `send_phone_verification_code` and `verify_phone_code` when provider env vars are configured

### Required environment variables for outbound delivery
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` or `EMAIL_FROM`
- `ADMIN_NOTIFICATION_TO`

### Required environment variables for SMS verification
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_VERIFY_SERVICE_SID`

### Best next pass after this
- wire the new notification approval actions into a dedicated visible admin approval panel in the live frontend
- add per-notification email preview/test send controls
- add requirement-level approve/reject buttons directly from job/equipment screens
- add provider-specific retry / dead-letter handling for email and SMS failures
