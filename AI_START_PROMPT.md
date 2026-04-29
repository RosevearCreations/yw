## 2026-04-23 start prompt update
- Preserve the scheduler duplicate-dispatch guard: Edge Function recalculates `next_run_at`, and SQL skips recently queued rows for 10 minutes.

<!-- Reviewed during 2026-04-22 workflow guardrail, portable scheduler sync, and repo-alignment pass. -->
<!-- Reviewed during 2026-04-21 scheduler Vault sync, evidence review, signed-contract kickoff, and payroll-close repo alignment pass. -->
<!-- Reviewed during schema 086 HSE ops performance and site-activity rollup pass on 2026-04-20. -->
<!-- Reviewed during schema 080 recurring agreements / payroll / asset history / login tracking pass on 2026-04-17. -->
## 2026-04-13 staff admin save verification pass
- Current scheduler truth: cron dispatch uses `service-execution-scheduler-run`; hosted Supabase can use Vault, and repo SQL now includes a safe fallback for environments where the Vault extension is unavailable.

- Added visible inline create/save/reset/block/delete confirmations in the Staff Directory screen so staff actions no longer fail silently from the operator’s point of view.
- Added stronger front-end email and password validation plus busy-state feedback for staff actions.
- Updated `supabase/functions/admin-manage/index.ts` so staff-detail saves now persist email changes instead of leaving the visible Email field unsaved.
- No new SQL migration was added in this pass; schema files were reviewed and remain on the 074 baseline.

> Last synchronized: April 14, 2026 (landscaping job workflow, crew planning, and schema 075)

## 2026-04-12 HSE control cues and inspection focus pass
- Added migration `sql/074_hse_control_cues_and_inspection_focus.sql`.
- HSE packets and packet events now expose structured machinery/tool, lifting/posture, weather/heat, and chemical/public-interaction fields so follow-up can be filtered instead of buried in free text.
- HSE Ops summary cards now keep machinery/lifting and chemical/public/cones pressure visible alongside the existing monitor shortcuts.
- Site Inspection now has category-focused hazard presets so inspections can capture the four requested field-risk themes more consistently on phone or desktop.

> Last synchronized: April 12, 2026 (HSE control cues, inspection focus, and schema 074)

> Last synchronized: April 12, 2026 (linked HSE review lanes, monitor shortcuts, admin drill-through, and schema 073)

> Last synchronized: April 11, 2026 (admin focus buttons, HSE action-item summaries, and monitor threshold pass)

> April 11, 2026 sync: reviewed during the HSE OSHA interface, packet events, and field signoff pass.

## 2026-04-11 journal sync exceptions and upload fallback pass
- Added migration `sql/068_journal_sync_exceptions_and_upload_failure_fallback.sql`.
- Added DB-backed `gl_journal_sync_exceptions` so stale, unbalanced, and missing-entry source batches are visible as first-class review items instead of hidden batch-state guesses.
- Added DB-backed `field_upload_failures` so failed job-comment and equipment-evidence uploads leave an auditable fallback trail for retry/resolution instead of failing silently.
- Extended Admin selectors/directory/manage/UI so sync exceptions and upload failures can be reviewed, resolved, or dismissed from the same backbone shell.
- Tightened job activity upload handling so comments can still save even when attachments fail, with clearer operator feedback and follow-up visibility.

## Continue from here
- Use `DEVELOPMENT_ROADMAP.md` and `KNOWN_ISSUES_AND_GAPS.md` as the decision anchor.
- The repo now includes migration 064 for receipt/work-order/account rollups and the schema snapshot has been corrected to match.
- Next strongest pass is true journal posting controls, material issue/usage flow, route execution state, and HSE proof closeout.

## Continue from here

> Last synchronized: April 11, 2026 (admin focus buttons, HSE action-item summaries, and monitor threshold pass)

## 2026-04-10 journal posting controls and material issue / usage pass
- Added migration `sql/066_journal_posting_controls_and_material_issue_usage.sql`.
- Added DB-side journal-batch rollups so line count, debit total, credit total, and balanced state are derived instead of tracked manually.
- Added DB-backed `material_issues` and `material_issue_lines` so receiving can progress into job usage, issued-cost totals, and variance visibility.
- Extended the Admin backbone so journal batches, journal entries, material issues, and material issue lines can be created and managed from the same operational shell.
- Continued the DB-first direction for shared operational data while keeping the next highest-value gaps visible: route execution lifecycle, HSE proof/reopen, and stronger source-to-journal automation.

## 2026-04-09 workflow rollups, posting, receiving-costing, and HSE closeout pass
- Added DB-first workflow logic so estimate, work-order, and material-receipt header totals can roll up from their line records instead of depending on manual entry.
- Added receivables/payables payment-application logic so invoices and bills can track paid amounts, remaining balance, and partial/paid status from posted payments.
- Added receiving-to-costing linkage so material receipt lines can feed received quantity / received cost visibility back into work-order execution.
- Extended linked HSE packets toward real progress and closeout handling with checklist-style completion fields, derived progress, and clearer Admin-side visibility.


> Last synchronized: April 8, 2026. Reviewed during the estimates/work-orders/routes/materials/subcontract/general-ledger foundation and documentation synchronization pass.

## 2026-04-04d profile/logbook repair and staff admin backend pass

## 2026-04-05 admin dropdown/catalog manager and assignment workbench pass
- Extended the Admin backend with a database-backed dropdown/catalog manager for positions, trades, staff tiers, seniority levels, employment statuses, and job types.
- Extended the Admin backend with an assignment workbench so Admin users can create, edit, and delete site/personnel assignments and reporting lines from the live app.
- Updated staff editing so key personnel fields now use populated dropdowns instead of fragile free-typed text where shared reference data already exists.
- Added migration `sql/058_admin_dropdown_catalogs_and_assignment_workbench.sql` and corrected the schema snapshot/catalog definitions in `sql/000_full_schema_reference.sql`.
- Narrowed the remaining risks toward live deployment validation, workflow depth, and stress-testing rather than basic screen rendering.

- Restored Profile and Logbook as fully rendered screens instead of empty shells by moving their required layout into the live modules.
- Fixed crew loading payload handling and made Logbook auto-load rows on open so empty pages now show real data or a clear empty state.
- Extended the Admin backend toward a real staff directory with Admin / Supervisor / Employee management controls for create, edit, block/unblock, delete, password reset, and staff hierarchy fields.
- Added migration `sql/057_staff_directory_and_role_admin.sql` and refreshed the schema reference snapshot.

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

## 2026-04-10 crew assignment, recurring jobs, and field activity pass
- Job creation now has a clearer ownership path: a crew can be assigned at the same time as an explicit supervisor so responsibility is visible from the start.
- Jobs now support standalone or recurring scheduling fields, with recurrence summary/rule storage in the database instead of leaving schedule logic only in draft UI state.
- Job comments now have a DB-backed activity trail with optional photo attachments and special-instruction flags so crews and supervisors can review site notes, uploaded images, and field changes in one place.
- This pass continues the DB-first direction for shared operational data and reduces duplication risk compared with keeping crew/job packet details only in local JSON or loosely coupled browser state.
- Start the next build by verifying migration 065, jobs-directory payloads, and live comment/photo upload behavior before moving further into dispatch/calendar tooling.

## 2026-04-10 source-generated journals, route execution, and HSE proof pass
- Added migration `sql/067_source_journal_route_execution_and_hse_proof.sql`.
- Added source-generated draft journal batches for AR invoices, AP bills, material receipts, and material issues so review/posting can start from the originating record instead of manual batch creation.
- Added route-stop execution lifecycle records plus attachment rows so daily field work can track completed, skipped, delayed, and exception states with note/photo support.
- Added HSE proof rows plus reopen-aware linked packet fields so closeout evidence, reopen counts, and follow-up exceptions are visible in the Admin backbone.
- Continued the DB-first move for shared operational/accounting data and refreshed the docs so roadmap, risks, testing, and deployment all point to the same next state.

## 2026-04-11 HSE operations hub and admin section-button pass
- Added a separate **HSE Operations** screen outside the long Admin page so safety workflows, OSHA-oriented reminders, and linked-packet shortcuts can be reached more quickly on desktop and mobile.
- Split the Admin experience into section buttons so people/access, jobs/operations, safety/monitoring, accounting, and messaging/diagnostics can be opened without one long scroll.
- Added migration `sql/072_hse_hub_and_accounting_review_summaries.sql` plus summary views for HSE follow-up and accounting review pressure.
- Corrected Admin selector/view alignment for traffic daily summary and HSE action-item ordering so the newer safety and monitoring shortcuts stay usable.
- Continued the DB-first direction while keeping HSE standalone-capable and easier to connect to jobs, work orders, routes, equipment, dispatches, sites, and subcontract work.


## Recent handoff emphasis
Continue from a landscaping-first application perspective. Jobs already support schedule and crew planning; current priority is to deepen pricing, estimates, contracts, and Ontario accounting behavior without losing fallback stability.
> Synchronized for the 2026-04-16 accounting-profitability and job-financial-rollup pass.


## 2026-04-19 employee time clock and attendance pass

- Added DB-backed `site_activity_events`, `v_site_activity_recent`, and `v_site_activity_summary` so Admin can review durable activity for staff creation/updates, new jobs, equipment changes, agreements, payroll exports, contracts, and related operational changes.
- Admin now loads and renders a Recent Site Activity table directly from the backend instead of relying only on login traces or per-screen notices.
- `admin-manage`, `jobs-manage`, and `account-maintenance` now record key activity events while still failing safely if the audit trail insert itself has a problem.
- Current schema target is now 082.


## 2026-04-21 sync note

Start from schema 088 and assume the Admin hub now includes:
- stored evidence review outcomes
- scheduler setting dispatch metadata
- signed-contract kickoff action
- payroll delivery confirmation / close-signoff workflow

## 2026-04-22 operator note
- Treat image score language as rule-based completeness, not AI judging.
- Keep scheduler SQL portable across Vault and non-Vault environments.
- Preserve the delivered -> confirmed -> closed payroll sequence in future passes.

## 2026-04-24 auth wall, historical reports, and OSHA reporting pass
- Fixed the public auth wall so logged-out users no longer see the live Toolbox Talk, PPE Check, First Aid Kit, Site Inspection, or Emergency Drill screens underneath the sign-in interface.
- Added a supervisor/admin **Historical Reports** screen with export-ready HSE form history, site/form rollups, and cross-workflow history covering submissions, HSE packet events, evidence review, scheduler runs, payroll exports, and signed contracts.
- Added migration `sql/089_historical_reporting_and_auth_wall_support.sql` and synced the full schema reference so reporting stays DB-backed instead of drifting into browser-only JSON snapshots.
- Continued the OSHA-facing direction by keeping the five field forms first-class while making their historical retrieval and review more usable for office and supervisor follow-up.
- Next strongest follow-up: add incident / near-miss reporting, saved report presets, richer trend charts, and deeper drill-down exports by site, worker, route, and work-order context.

## 2026-04-24 incident reporting, DB-backed report presets, and richer HSE analytics pass
- Added a new **Incident / Near Miss** field form so workers and supervisors can capture injuries, close calls, damage, witness names, immediate actions, and corrective-action ownership without waiting for office follow-up.
- Added migration `sql/090_incident_reporting_saved_report_presets_and_trends.sql`.
- Added DB-backed reporting presets (`report_presets`) so supervisors and admins can reuse saved report filters without depending on local browser storage.
- Expanded reporting with DB-backed views for incident history, monthly trends, worker rollups, and site/job/route context rollups.
- Reworked the historical reports screen to use the richer DB-backed datasets and added incident CSV export.
- Added a dedicated incident quick link in the public nav, HSE Ops, and Admin hub so the OSHA-facing workflows stay easy to reach on mobile and desktop.
- Next strongest follow-up: training history + certification expiry, SDS acknowledgement tracking, OSHA 300/300A/301-oriented recordkeeping helpers, and corrective-action task assignment from incident rows.

## 2026-04-25 corrective actions + training pass
- Synced the repo to include first-class corrective-action tasks, training / certification expiry tracking, SDS acknowledgement history, and management-focused reporting.
- See `docs/CORRECTIVE_ACTIONS_AND_TRAINING.md` and the new `sql/091_corrective_actions_training_and_sds_tracking.sql` migration.


Current repo includes management workflow migration 092; continue from subscriptions/delivery automation, worker self-service acknowledgement UI, and JSA drill-through.

## Latest pass note (2026-04-25d)
- Synced for scheduled report delivery, worker self-service training/SDS acknowledgement, and Jobs commercial/accounting foundation planning.

## 2026-04-26 pass note

This pass moves the project into the Jobs commercial/accounting phase.
It adds the 094 Jobs commercial workflow foundation, updates the repo status toward estimate/work-order/completion/accounting readiness, and keeps the schema/docs aligned for the next phase.


## Pass 096 notes

This pass adds branded quote output, automatic threshold evaluation, closeout evidence linkage, invoice/journal posting-rule structures, accountant handoff exports, and profitability/variance scorecards for the Jobs commercial workflow.
