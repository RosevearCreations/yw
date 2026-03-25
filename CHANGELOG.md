# Changelog

## Current pass
- added top-right session controls with signed-in name, settings, and logout
- expanded user hierarchy model with default/override supervisor/admin fields
- added start date, employee number, and strengths support
- expanded admin profile and site forms
- added jobs and equipment planning screens
- added `js/jobs-ui.js`
- added SQL files 043, 044, and 045
- added Edge Functions `jobs-directory` and `jobs-manage`
- updated markdown docs to match this pass


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

## Password-First Auth / Admin Approval UI Pass (March 24, 2026)

This pass shifts the app to a password-first daily login flow while keeping magic link as backup/recovery only, and brings the approval/email workflow into the live frontend.

### Included in this pass
- bootstrap now restores Supabase sessions from `code=` callbacks as well as token hashes
- login screen is now clearly password-first with forgot-password support and cleaner auth-wall behavior
- settings now renders a live account security panel with password save/change, email verification resend, phone verification request, SMS code send/verify, and logout controls
- admin now renders a visible approval queue with approve/reject/resolve actions
- admin now includes email preview, test-send, and retry-send controls for notifications
- jobs/equipment screens now render live forms inside the frontend shell instead of depending on missing static markup
- jobs now support direct requirement review buttons for request / approve / reject actions
- backend notification actions now support preview_email, test_send, and retry_send
- account maintenance now supports retry_phone_verification_code
- functions no longer depend on `admin_notifications.subject` existing

### Most valuable next pass after this
- add richer job editing/loading from saved rows back into the form
- add stronger per-role UI hiding for approve/reject buttons
- add provider-specific delivery attempt counters and dead-letter handling
- add full admin CRUD layout restoration if broad directory management becomes the next focus

## 2026-03-24 pass: auth, approvals, delivery retries, and saved-job restore

This pass adds four major improvements:
- password-first sign-in remains the normal path after first validation, with magic link kept as backup/recovery only
- auth callback parsing now safely handles Supabase `code=` links and broken multi-hash URLs like `#toolbox#access_token=...`
- saved jobs and equipment rows can now be loaded back into the live form for editing
- admin notifications now support provider-specific delivery attempt counters plus dead-letter tracking for failed email/SMS retry workflows

Additional notes for this pass:
- added a compatibility `bootstrap-admin` Edge Function for stale cached callers
- added stronger per-role hiding for job requirement approve/reject buttons
- added schema migration `049_auth_delivery_attempts_and_dead_letters.sql`
- updated `000_full_schema_reference.sql` to include email/SMS provider and attempt tracking fields
- next broad admin focus can restore full CRUD directory layouts without conflicting with this pass

## 2026-03-24 pass: password-first auth hardening and equipment asset history

This pass fixes the remaining auth wall problem by making the app render a real login screen even when runtime auth configuration is missing or broken.

### What changed
- login remains email + password first, with magic link kept as backup / recovery only
- bootstrap now reports a readable configuration error instead of trapping the user behind a blank magic-link wall
- a one-time runtime Supabase anon key entry panel is available on the login screen for deployments that missed frontend auth config
- header now shows login while signed out, then login name + settings + logout while signed in
- settings continue to expose password save/change, resend verification, phone verification, and logout controls
- equipment records now support rental-style asset fields: pool key, serial, asset tag, manufacturer, model, year, purchase date, purchase price, condition, image URL, comments
- equipment checkout / return now capture typed worker, supervisor, and admin sign-off names plus checkout/return condition notes
- equipment history is returned to the frontend for traceability

### Files added / updated in this pass
- `sql/050_equipment_asset_history_and_auth_runtime.sql`
- `sql/000_full_schema_reference.sql`
- `js/bootstrap.js`
- `js/auth.js`
- `js/ui-auth.js`
- `js/jobs-ui.js`
- `index.html`
- `supabase/functions/jobs-manage/index.ts`
- `supabase/functions/jobs-directory/index.ts`

### What to run on an existing database
- run `sql/050_equipment_asset_history_and_auth_runtime.sql`
- keep `sql/000_full_schema_reference.sql` as the reference snapshot, not the normal migration to run over a live database

### Best next pass after this
- move typed sign-off names to real signature capture storage when the device workflow is ready
- add equipment maintenance / service intervals, inspection history, and defect lockout workflow
- restore the broader admin CRUD directory layout when that becomes the next focus

## Pass Update — 2026-03-24 equipment maintenance + visible approval tools

This pass extends the existing jobs / equipment / notification work in four practical ways:
- the equipment interface is now easier to find from the top navigation and directly from the Jobs screen using **Open Equipment Interface**
- the equipment module now supports maintenance/service intervals, inspection history, defect notes, and lockout status in both schema and UI
- the live Equipment screen now includes **Record Inspection**, **Record Service**, **Lockout**, and **Clear Lockout** actions plus history tables
- the jobs/equipment data directory now returns maintenance and inspection history alongside pool availability, signout history, and approval notifications

### SQL added in this pass
- `sql/051_equipment_maintenance_lockout_and_history.sql`

### Main code updated in this pass
- `js/jobs-ui.js`
- `supabase/functions/jobs-manage/index.ts`
- `supabase/functions/jobs-directory/index.ts`
- `sql/000_full_schema_reference.sql`

### Notes
- the visible admin approval queue and email preview/test-send controls remain in the Admin screen
- requirement approval actions remain role-aware, and the Jobs screen now includes a direct link to the Equipment interface
- typed signature names are still the current device-friendly sign-off approach; true signature capture storage remains a later pass
- broader admin CRUD restoration is still possible later without conflicting with this equipment/history pass

### Best next pass after this
- move typed sign-off names to real signature capture storage when the device workflow is ready
- add image/file attachments to maintenance and inspection events
- add scheduled service / inspection reminders using the due-date fields now in schema
- restore broader admin CRUD layout if directory management becomes the main focus again

---

## 2026-03-24e pass

This pass focused on app-shell access reliability, visible login behavior, and equipment screen discoverability.

Implemented in this pass:
- the login form now remains visible even while auth/session restore is still running
- a readable cached-files / auth-not-restored warning now appears when service-worker cache or callback restore may be involved
- Equipment is now kept visible in the main nav for signed-in users instead of disappearing silently
- Jobs and Equipment sections now show clear permission notices instead of hiding the whole section
- quick access buttons were added to the signed-in dashboard area for Equipment, Jobs, and Settings
- silent section hiding for Jobs / Equipment was removed from the jobs module
- service worker cache version was bumped again to reduce stale shell problems

Schema status for this pass:
- no new database migration was required for the app-shell visibility changes in this pass
- `sql/000_full_schema_reference.sql` remains the full schema reference snapshot
- the latest live migration for equipment maintenance / lockout remains `sql/051_equipment_maintenance_lockout_and_history.sql`

