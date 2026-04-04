## 2026-04-03 admin password control and order/accounting scaffold pass
- Added admin-managed password reset capability for any profile, including other admins, with audit logging in `admin_password_resets` and notification history.
- Added a basic sales-order and accounting scaffold so creating an order now also creates an initial accounting row for later cost, inventory, revenue, and tax workflows.
- Extended the Admin screen with password control, order creation, order list, and accounting list panels.
- Extended the admin directory/function layer so orders and accounting records are visible in the live app.
- Added migration `sql/056_admin_password_resets_and_sales_accounting_stub.sql` and refreshed `sql/000_full_schema_reference.sql`.
- Continued SEO/cache/CSS cleanup with updated shell versioning, homepage metadata tuning, and minor admin panel style tightening.
- Remaining live work before stress testing: deploy migration 056, deploy updated Edge Functions, then validate admin password reset and order/accounting creation in the real environment.

## 2026-03-31 session health and onboarding completion pass

## 2026-04-01 conflict review, CI smoke-check, and diagnostics timing pass
- Added visible conflict review panels in Settings and Admin so queued local actions can be compared, retried, kept local, or discarded instead of staying as opaque conflict rows.
- Added module/startup timing capture and exposed it through in-app diagnostics, support snapshot export, and smoke-check reporting for deeper boot troubleshooting.
- Added a repository smoke-check script plus GitHub Actions workflow so baseline release verification now runs automatically in CI/CD instead of being manual-only.
- No new SQL migration was required. `sql/000_full_schema_reference.sql` remains the current schema snapshot and `055_storage_onboarding_identity_change_and_bootstrap.sql` remains the latest live migration.

### Remaining sign-off item
- Live deployed auth/runtime verification still needs to be confirmed against your actual environment because that cannot be completed from the zip alone. The codebase is now prepared with better conflict review, smoke automation, and timing diagnostics for that final live verification.

- Fixed the separate onboarding-complete path so it can also finalize `account_setup_completed_at` when username and password readiness are already satisfied.
- Added signed-in session health probing to the frontend API/smoke checks and added a Support & Session Health panel in Settings with exportable troubleshooting snapshots.
- No new SQL migration was required in this pass; `sql/000_full_schema_reference.sql` remains the refreshed reference snapshot and `055_storage_onboarding_identity_change_and_bootstrap.sql` remains the latest live migration.

## 2026-03-31 build repair pass
- Fixed the service-worker duplicate cache entry that was causing `Cache.addAll(): duplicate requests` during install.
- Restored Admin smoke-check wiring by exporting `runSmokeCheck` through `window.YWIAPI` and rebinding the Admin screen to that helper.
- Hardened protected-module startup so Reference Data init no longer throws when a module init returns no Promise.
- Increased bootstrap session-restore timeout and refreshed account setup flow so password save is followed by a session refresh before setup completion is submitted.
- Fixed recovery email handling so password reset prefers `recovery_email` when available and returns to `#settings` in the current shell.
- Added a `session_health` account-maintenance action for signed-in diagnostics.
- No new SQL migration was required. `sql/000_full_schema_reference.sql` remains the schema snapshot and `055_storage_onboarding_identity_change_and_bootstrap.sql` remains the latest live migration.

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

## Pass Update - 2026-03-25 Runtime Config, Offline UX, and Equipment Return Evidence

This pass fixes the remaining frontend runtime-config crash path by removing the last bare `SUPABASE_URL` client creation call and standardizing frontend API routing on the runtime config object. The app now uses `js/app-config.js` as the primary normal-use source, keeps the login-screen anon key entry as emergency fallback only, and surfaces offline/disconnected state in the shell so mobile users know when sign-in, uploads, and sync are unavailable.

Equipment tracking was extended to support post-return evidence handling. Checkout and return now accept multiple evidence photos in the Equipment screen, store counts in history, and track explicit return damage flags and notes alongside captured signatures. The next storage-focused pass can move large image payloads out of row storage into object storage with signed URLs.

Additional quality changes in this pass:
- clearer offline and connection-aware error handling in frontend fetch helpers
- runtime connection diagnostics helper for auth/config troubleshooting
- continued consolidation of duplicate frontend connection settings so Supabase URL handling is no longer split between hardcoded and runtime-only paths
- schema and view updates for richer equipment signout history

## 2026-03-26 security/account/equipment reliability pass
- Switched the app toward a true account-setup flow after magic-link validation or password recovery.
- Added profile flags for password-ready/account-setup-complete state.
- Settings now supports richer contact/address saving, password reset email, and account-setup completion.
- Jobs and Equipment screens now autosave local drafts to reduce remote-connection data loss.
- Service worker cache version was bumped again to reduce stale app shell issues after auth changes.

### Best next steps
1. Move equipment photo/signature evidence into Supabase Storage objects with audit rows instead of row JSON/base64 payloads.
2. Add explicit first-run onboarding screens for new users instead of routing them straight into Settings.
3. Expand autosave/outbox coverage from Jobs/Equipment into profile and admin forms.
4. Add server-side validation messages for duplicate usernames and invalid address/postal formats.
5. Add account email/username change confirmation workflows.


## 2026-03-26 login/bootstrap stability pass

This pass focused on the app-shell and auth startup problems that were leaving users stuck on **Checking sign-in status...** or showing half-loaded worker screens. The frontend now defers protected module loading until an authenticated session exists, restores missing Jobs draft constants, aligns local asset cache-busting to one release tag, adds packaged icons/favicons to stop manifest 404s, and adds a bootstrap timeout so the login form can recover if email-link session restoration hangs. No new schema migration was added in this pass; `sql/000_full_schema_reference.sql` remains the current reference snapshot.


## 2026-03-26 confirmation history and autosave reliability pass
- Kept Supabase Storage + `equipment_evidence_assets` as the primary evidence path for equipment photos/signatures; no new inline JSON/base64 evidence storage was introduced in this pass.
- Added self-service identity-change history loading in Settings so users can see pending, approved, and rejected username/email requests without waiting on admin replies.
- Added user-facing confirmation notifications when admins approve or reject identity-change requests.
- Expanded autosave/recovery coverage into the self-profile screen and the admin queue workspace (filters plus email preview fields).
- Refreshed the app documentation to reflect that no new SQL migration was required beyond `055_storage_onboarding_identity_change_and_bootstrap.sql` for this pass.

### Best next steps
1. Add a dedicated user inbox/activity panel that surfaces admin notifications and approval results without requiring the Settings screen.
2. Move profile-form autosave drafts into a shared outbox/replay queue for true offline-first syncing.
3. Add admin-side approval controls that can trigger real Auth email-change workflows after request approval.
4. Add thumbnail galleries and delete/replace actions for Storage-backed equipment evidence assets.

## 2026-03-29 diagnostics and identity-sync pass
- Added a visible diagnostics banner so startup/auth/module failures are surfaced in the app instead of only in DevTools.
- Added protected-screen retry controls from the diagnostics banner after auth/bootstrap failures.
- Wired admin approval of `account_identity_change_requests` to also sync the Auth user record (email and username metadata) before the profile change is finalized.
- Removed a duplicated Deploy Smoke Check block from the Admin screen and refreshed the docs/schema snapshot notes.
- No new SQL migration was required for this pass; schema remains current through `055_storage_onboarding_identity_change_and_bootstrap.sql`.

## 2026-03-31 Runtime/Auth alignment pass

Current state after this pass:
- Frontend runtime config now prefers custom `SB_URL` and `SB_ANON_KEY` first, while keeping `SUPABASE_*` as compatibility fallbacks.
- Edge Functions now prefer custom `SB_URL` and `SB_SERVICE_ROLE_KEY` first, while keeping `SUPABASE_*` as compatibility fallbacks.
- `account-maintenance` now uses the incoming bearer token with the service-role client and has `verify_jwt = false` configured so function auth is handled in-code instead of by the edge gateway.
- Remaining live verification after deploy should focus on `account-maintenance` save/update paths, then `admin-directory`, `reference-data`, and `jobs-directory` if any 401s remain.
- The next chat should start from verifying the live deployed `SB_*` runtime path, then checking the first failing function response body if any auth error remains.
