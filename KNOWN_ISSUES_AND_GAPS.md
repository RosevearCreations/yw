## 2026-04-05d session integrity and CORS stabilization pass
- Mitigated a major session-mixing risk by preventing stale profile/session fetches from overwriting a newer authenticated identity after navigation.
- Mitigated logout reliability risk by clearing local auth state immediately before the remote sign-out completes, reducing the chance of mixed role/name fragments staying visible in the shell.
- Reduced legacy role drift by normalizing `worker`/`staff` semantics toward `employee` in both frontend evaluation and the new profile guardrail migration.
- Remaining live validation still needs to confirm that the deployed `review-list` function picks up the fixed CORS/preflight handling and that protected function role checks now stay stable across screen changes.

## 2026-04-05c session isolation, CORS, and auth hardening pass
- Hardened role normalization so legacy worker/staff values no longer demote active admin/supervisor sessions in the live shell.
- Prevented Profile and Reference Data from refetching protected data after logout/session removal, reducing cross-user bleed and repeated 401 loops.
- Added a dedicated `review-list` Edge Function with explicit preflight/CORS handling for the Logbook screen.
- Tightened protected-function role evaluation so `staff_tier` and Auth metadata can preserve admin/supervisor access when legacy profile role text is stale.
- Remaining live validation should focus on confirming session identity stays stable across screen changes, logout always works, and `review-list` preflight succeeds after deploy.

## 2026-04-04d profile/logbook repair and staff admin backend pass

## 2026-04-05b save-reliability, onboarding completion, and admin bootstrap pass
- Fixed onboarding completion handling so the Settings onboarding block can fully clear after a successful complete action instead of looping on the button state.
- Added employee/worker role compatibility across frontend security, auth state, and protected functions so staff roles no longer collapse back to worker semantics in the live app.
- Added a generic `scripts/create-admin-account.mjs` bootstrap script for creating or re-seeding a real administrator account with verified login-ready profile data.
- Added migration `sql/059_role_aliases_admin_bootstrap_and_onboarding_fix.sql` to normalize legacy worker profile roles toward employee-facing staff records, keep assignment roles compatible, and backfill missing onboarding completion timestamps.
- Tightened admin profile saving so profile updates also refresh Auth user metadata for role/full-name/employee-number alignment.


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

## 2026-04-04c interface restoration and admin-workflow preparation pass
- Restored missing live screen layouts for Toolbox Talk, PPE Check, First Aid Kit, Site Inspection, and Emergency Drill so hash routes no longer land on empty cards.
- Added shared datalist placeholders back into the shell for site, employee, and first-aid catalog lookups used by the form modules.
- Bumped shell/cache asset versions again to flush stale blank-screen markup and keep the smoother interface consistent after deploy.
- No new SQL migration was required in this pass; schema remains current through `056_admin_password_resets_and_sales_accounting_stub.sql`.
- Current roadmap emphasis after this pass: stabilize the restored worker screens, then continue expanding the admin/supervisor/employee backend workflow for approvals, job creation, and personnel assignment before stress testing.



## 2026-04-04b live auth repair and compatibility pass
- Added a compatibility `api/auth/account-maintenance.js` route so newer frontend shells no longer hard-fail when the live `account-maintenance` Edge Function is missing or stale during deployment overlap.
- Updated `js/auth.js` and `js/api.js` so account-maintenance calls fall back to the compatibility route on HTTP 404 instead of blocking password login, onboarding completion, reset, or session-health actions.
- Added `verify_jwt = false` config files for protected Edge Functions that already validate bearer tokens in code (`admin-directory`, `jobs-directory`, `reference-data`, `admin-manage`, `admin-selectors`, `jobs-manage`, and `upload-equipment-evidence`) so gateway-level JWT rejection stops causing false 401 loops.
- Wrapped account and admin password controls in real forms with hidden username fields and password autocomplete attributes to remove browser password-form warnings while keeping the daily login UI standard.
- Remaining live verification after deploy: redeploy the updated Supabase function set, reload the shell once, then confirm `account-maintenance` stops returning 404 and protected functions stop returning 401 for a valid signed-in session.

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

### Remaining active gaps after this pass
1. Verify the live deployed `SB_*` runtime path and capture the first failing function response body if any 401 remains.
2. Validate the new conflict-review controls and timing traces against a real authenticated deployment.

## 2026-03-31 build repair pass
- Fixed the service-worker duplicate cache entry that was causing `Cache.addAll(): duplicate requests` during install.
- Restored Admin smoke-check wiring by exporting `runSmokeCheck` through `window.YWIAPI` and rebinding the Admin screen to that helper.
- Hardened protected-module startup so Reference Data init no longer throws when a module init returns no Promise.
- Increased bootstrap session-restore timeout and refreshed account setup flow so password save is followed by a session refresh before setup completion is submitted.
- Fixed recovery email handling so password reset prefers `recovery_email` when available and returns to `#settings` in the current shell.
- Added a `session_health` account-maintenance action for signed-in diagnostics.
- No new SQL migration was required. `sql/000_full_schema_reference.sql` remains the schema snapshot and `055_storage_onboarding_identity_change_and_bootstrap.sql` remains the latest live migration.

This is where we list known issues and gaps that need to be addressed


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

## 2026-03-28 login stability and compatibility pass
- Added a Vercel-host compatibility endpoint at `api/auth/bootstrap-admin.js` so older cached shells no longer hit an HTML 404 and crash on JSON parsing when they call `/api/auth/bootstrap-admin`.
- Hardened `js/api.js` error handling so HTML error pages are reported as readable compatibility/deployment issues instead of raw JSON parse failures.
- Strengthened `js/bootstrap.js` timeout fallback so timed-out email-link restores explicitly clear stale recovered session state before showing the regular sign-in screen.
- Updated `server-worker.js` to use a stronger network-first strategy for the app shell (`index.html`, `app.js`, `style.css`, `/js/*`, icons, manifest, favicon) to reduce mixed old/new cached shell behavior.
- Refreshed documentation and schema snapshot notes; no new SQL migration was required for this pass.


### Remaining best next steps after the 2026-03-28 pass
1. Add a visible user inbox/activity panel so approval results and account-change decisions are visible outside Settings.
2. Move profile/admin autosave into a shared offline outbox/replay queue with conflict indicators.
3. Add thumbnail gallery, replace, and delete actions for Storage-backed equipment evidence assets.
4. Add a deploy-time smoke check that verifies the frontend shell version, `js/app-config.js`, and Edge Function reachability before release.


## 2026-03-28 inbox, smoke-check, and evidence gallery pass
- Added a visible user activity inbox in Settings so approval results and account-change notifications are available outside the identity-request table.
- Added shared offline action outbox support for account/profile and admin notification actions, including retry controls and conflict-style pending counts.
- Added an admin deploy smoke-check panel that verifies runtime config and bootstrap endpoint reachability before release.
- Added equipment evidence gallery viewing plus delete/replace actions for Storage-backed equipment evidence assets.
- Refreshed documentation and schema snapshot notes; no new SQL migration was required for this pass.

## 2026-03-29 diagnostics and identity-sync pass
- Added a visible diagnostics banner so startup/auth/module failures are surfaced in the app instead of only in DevTools.
- Added protected-screen retry controls from the diagnostics banner after auth/bootstrap failures.
- Wired admin approval of `account_identity_change_requests` to also sync the Auth user record (email and username metadata) before the profile change is finalized.
- Removed a duplicated Deploy Smoke Check block from the Admin screen and refreshed the docs/schema snapshot notes.
- No new SQL migration was required for this pass; schema remains current through `055_storage_onboarding_identity_change_and_bootstrap.sql`.
### Remaining best next steps after the 2026-03-29 pass
1. Add conflict-aware replay for the shared outbox so queued profile/admin actions can be merged safely after reconnect.
2. Add thumbnail progress states and bulk actions for Storage-backed equipment evidence assets.
3. Add a release checklist step that verifies the diagnostics banner stays empty on a clean authenticated boot.
4. Expand the diagnostics feed to include server-side validation details for failed approval or profile save attempts.



## 2026-03-29 conflict-aware replay, diagnostics detail, and evidence bulk-actions pass
- Added conflict-aware replay behavior for the shared action outbox so repeated profile/admin actions merge by conflict key, keep attempt counts, and surface true conflict states instead of silently piling up duplicates.
- Expanded the diagnostics feed so validation/detail arrays returned from API and approval/profile save failures are shown in the in-app diagnostics banner instead of only a generic message.
- Added a diagnostics-empty smoke-check result so release checks now verify the diagnostics banner is clear on a clean authenticated boot.
- Added equipment evidence gallery bulk-select/bulk-delete controls plus visible upload-progress state text for replace/delete actions on Storage-backed evidence assets.
- Refreshed documentation and schema snapshot notes; no new SQL migration was required for this pass.

### Status after the 2026-04-01 sign-off prep pass
1. Side-by-side conflict review controls are now in the live Settings and Admin screens for queued local actions.
2. Automated repository smoke-check execution is now wired into GitHub Actions CI/CD.
3. Diagnostics collection now includes startup and module timing traces for deeper troubleshooting.
4. Remaining work is limited to live environment verification and any follow-up fixes from real deployment testing.

## 2026-03-31 Runtime/Auth alignment pass

Current state after this pass:
- Frontend runtime config now prefers custom `SB_URL` and `SB_ANON_KEY` first, while keeping `SUPABASE_*` as compatibility fallbacks.
- Edge Functions now prefer custom `SB_URL` and `SB_SERVICE_ROLE_KEY` first, while keeping `SUPABASE_*` as compatibility fallbacks.
- `account-maintenance` now uses the incoming bearer token with the service-role client and has `verify_jwt = false` configured so function auth is handled in-code instead of by the edge gateway.
- Remaining live verification after deploy should focus on `account-maintenance` save/update paths, then `admin-directory`, `reference-data`, and `jobs-directory` if any 401s remain.
- The next chat should start from verifying the live deployed `SB_*` runtime path, then checking the first failing function response body if any auth error remains.


## 2026-03-31 Auth and onboarding status
- Runtime auth now prefers SB_URL / SB_ANON_KEY / SB_SERVICE_ROLE_KEY across frontend, Vercel compatibility route, and Edge Functions.
- `needsAccountSetup` is now computed from profile flags (`username`, `password_login_ready`, `account_setup_completed_at`) instead of lingering recovery state alone.
- Worker default route was corrected back to `toolbox` so normal screens open after sign-in.
- Remaining focus for next pass: verify worker pages render after fresh login without stale session state; keep onboarding banner hidden once account setup flags are complete.