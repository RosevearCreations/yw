
## 2026-04-04 login/auth shell repair and protected-screen recovery pass
- Reworked the visible login/logout flow toward a standard daily sign-in shell with clearer signed-in state, better section fallback content, and more obvious protected-screen guidance.
- Wrapped account and admin password inputs in real forms to remove browser password-field warnings and improve submission behavior.
- Hardened onboarding completion so it now validates missing username/password state, shows success/error feedback, refreshes auth state, and routes back into the standard app flow after completion.
- Added stronger 401 diagnostics in the frontend so protected request failures explain re-login/redeploy guidance instead of leaving screens feeling blank.
- Added `config.toml` with `verify_jwt = false` for the protected Edge Functions that already validate bearer tokens in code, aligning them with `account-maintenance` and addressing the repeated live 401 issue pattern.
- Added light shell placeholders so sections no longer appear completely blank while modules are loading or when a protected module fails.
- No new SQL migration was required in this pass; `sql/056_admin_password_resets_and_sales_accounting_stub.sql` remains the latest live migration and `sql/000_full_schema_reference.sql` was refreshed as the current snapshot.

### Best next live validation after deploy
1. Hard refresh / clear service worker once after deploy.
2. Sign in with username/email + password through the normal login form.
3. Complete onboarding and confirm the success notice + redirect back into the app.
4. Verify `admin-directory`, `jobs-directory`, and `reference-data` no longer return 401 in the deployed environment.
5. Confirm non-settings screens load their normal content instead of remaining blank.

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

Enter next development steps here

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

## 2026-03-26 storage-backed evidence, onboarding, and credential recovery pass
- Fixed the signed-out account lookup/recovery path so it can call `account-maintenance` with anon/public auth headers instead of failing with `HTTP 401 Missing authorization header`.
- Added `scripts/bootstrap-auth-users.mjs` to create/update the requested starter admin and employee accounts through the Supabase Admin API.
- Added `sql/055_storage_onboarding_identity_change_and_bootstrap.sql` for onboarding fields, identity-change requests, and storage-backed equipment evidence audit rows.
- Added `supabase/functions/upload-equipment-evidence` so equipment checkout/return photos and signature captures are stored as Supabase Storage objects with audit rows in `equipment_evidence_assets`.
- Updated `jobs-manage`, `jobs-directory`, `api.js`, and `jobs-ui.js` so checkout/return now return a signout id and upload evidence/signatures into Storage after the signout record exists.
- Added explicit first-run onboarding UI, account draft autosave, and email/username change request workflow in Settings.
- Added server-side validation messages for duplicate usernames, duplicate emails, incomplete address line 1, invalid province text, and invalid Canadian postal-code format.
- Continued reducing duplicate failure points by making storage-backed evidence metadata database-first instead of storing large JSON/base64 payloads directly in signout rows.

### Temporary scripted bootstrap passwords
- `veardev@live.ca` -> `YwiAdmin!2026#Start`
- `veardev@gmail.com` -> `YwiWorker!2026#Start`
- Change both immediately after first sign-in.

### Best next steps
1. Add admin review screens for `account_identity_change_requests` and equipment evidence galleries with approve/reject comments.
2. Move the starter account bootstrap script into a protected internal runbook or CI-only admin task so passwords are never committed long term.
3. Add retry queue / outbox support for failed equipment evidence uploads while offline.
4. Extend autosave coverage into more admin CRUD forms if broader directory management becomes the next focus.



## 2026-03-26 login/bootstrap stability pass

This pass focused on the app-shell and auth startup problems that were leaving users stuck on **Checking sign-in status...** or showing half-loaded worker screens. The frontend now defers protected module loading until an authenticated session exists, restores missing Jobs draft constants, aligns local asset cache-busting to one release tag, adds packaged icons/favicons to stop manifest 404s, and adds a bootstrap timeout so the login form can recover if email-link session restoration hangs. No new schema migration was added in this pass; `sql/000_full_schema_reference.sql` remains the current reference snapshot.

### Next steps after this pass

1. Add a signed-in boot diagnostics panel that shows the exact module and endpoint that failed during startup.
2. Move more offline-safe draft saving into profile/admin screens and add visible draft recovery banners.
3. Add server-side session health checks to the first-run onboarding flow so stale magic-link callbacks can be diagnosed without opening DevTools.
4. Continue the equipment workflow by moving more evidence uploads and return damage review into dedicated admin review screens.


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
### Best next steps after the 2026-03-29 diagnostics and identity-sync pass
1. Extend the shared outbox into a true conflict-aware replay queue with per-action diff details.
2. Add bulk evidence management actions (multi-delete / replace / relabel) for equipment evidence assets.
3. Surface diagnostics banner entries inside a dedicated support/export screen for easier remote troubleshooting.
4. Add release automation that smoke-checks runtime config, auth bootstrap, and an authenticated worker boot before publish.



## 2026-03-29 conflict-aware replay, diagnostics detail, and evidence bulk-actions pass
- Conflict-aware action outbox replay/merge.
- Diagnostics banner now shows validation detail arrays.
- Smoke check now verifies diagnostics banner is empty after clean boot.
- Equipment evidence gallery now supports bulk select/delete and clearer replace progress messaging.

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
