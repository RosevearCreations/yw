Read `AI_CONTEXT.md` and `PROJECT_BRAIN.md` first.

Current focus:
- richer employee/supervisor/admin hierarchy
- backend enforcement of visibility rules
- jobs and equipment reservation workflow
- keep markdown docs aligned with every code pass

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
- a one-time emergency fallback Supabase anon/public key entry panel remains available on the login screen if `js/app-config.js` is missing or stale
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

## 2026-03-25 pass: account recovery, credentials polish, and equipment signature capture

Completed in this pass:
- Password sign-in now accepts either email or username. The frontend resolves usernames through the account-maintenance function before Supabase password login.
- Login screen now includes an account recovery helper that verifies employee number + phone last 4 + last name, returns masked login hints, and can send a recovery email.
- Settings account panel now supports saving username and recovery email in addition to phone/password actions.
- Equipment checkout/return now supports real signature image capture on device and stores PNG data on signout history rows instead of relying only on typed names.
- Added migration `sql/052_account_recovery_and_equipment_signature_capture.sql`.
- Full schema reference updated to include recovery fields, recovery request history, and equipment signature PNG fields.

Operational note:
- On existing databases, run only `sql/052_account_recovery_and_equipment_signature_capture.sql` for this pass.
- Do not run `sql/000_full_schema_reference.sql` on a live existing database unless rebuilding from scratch.

Most valuable next pass after this:
- replace PNG/base64 signature storage with uploaded file storage plus signed URLs
- add admin review screens for account recovery attempts and failed login help requests
- move more duplicated selector/reference JSON into database-backed catalogs where the app already reads database-first
- harden per-role credential and settings visibility with clearer audit history


## 2026-03-25 runtime config pass
- frontend auth config now loads from `js/app-config.js` first, using `window.YWI_RUNTIME_CONFIG` as the primary source of truth
- runtime localStorage anon-key entry remains available only as an emergency fallback from the login screen
- service worker now treats `js/app-config.js` as network-first to reduce stale cached credential/config problems
- bootstrap/auth errors now direct deployment fixes toward `js/app-config.js` instead of treating manual runtime entry as the normal path
- no database migration was added in this pass; `sql/000_full_schema_reference.sql` was refreshed as the current reference snapshot
