## 2026-03-30 conflict save-back, bundled support export, authenticated smoke-check, and evidence relabel pass
- Added direct conflict save-back tools for queued account/admin actions so merged values can be pushed immediately instead of waiting for replay alone.
- Added a bundled support export from the diagnostics banner that includes diagnostics, latest smoke-check results, runtime-config state, and per-module startup timing.
- Expanded smoke checks to retain the latest result and support authenticated admin/jobs directory checks when a signed-in session is present.
- Added equipment evidence metadata save controls so gallery assets can be relabeled and moved between checkout/return groupings without re-uploading.
- Added richer bulk replace progress messaging in the equipment evidence gallery.
- Added a GitHub Actions smoke-check workflow that validates shell hooks and the single-H1 rule in the exposed page.
- No new SQL migration was required. `sql/000_full_schema_reference.sql` remains the current schema snapshot and `055_storage_onboarding_identity_change_and_bootstrap.sql` remains the latest live migration.

### Status after this pass
- The currently documented Known Issues / Gaps list has been completed through the items tracked in this file.
- The next stage can now shift from gap closure into broader application build-out, staging verification, and workflow expansion.

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

## 2026-03-30 auth recovery, smoke-check export, and evidence bulk-replace pass
- Fixed the Admin startup issue by exporting `runSmokeCheck` through `window.YWIAPI`, so the Deploy Smoke Check panel no longer crashes when clicked.
- Fixed account recovery so password-reset emails prefer `recovery_email` over stale `profiles.email` values when available, and account lookup masks the same target email.
- Updated the recovery redirect target so reset links return users to `#settings` in the current shell instead of drifting into an older cached route.
- Added diagnostics export from the in-app banner for remote support and troubleshooting.
- Added multi-file bulk replace support for selected equipment evidence assets, with visible progress text during replacement.
- Added a GitHub Actions smoke-check workflow that verifies the shell, recovery hooks, smoke-check export, and the single-H1 rule on the exposed page.
- No new SQL migration was required. `sql/000_full_schema_reference.sql` remains the current schema snapshot and `055_storage_onboarding_identity_change_and_bootstrap.sql` remains the latest live migration.

### Remaining best next steps after the 2026-03-30 pass
1. Add backend-assisted field-by-field save-back for conflict merges so resolved drafts can be pushed without waiting for replay.
2. Extend the automated smoke check to run authenticated worker/admin boot tests against a staging deployment.
3. Add evidence relabel/move actions and richer thumbnail progress bars for larger replacement batches.
4. Add a bundled support export that combines diagnostics, smoke-check results, runtime config state, and module boot timing.

