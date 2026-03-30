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

### Remaining best next steps after the 2026-03-29 conflict-aware replay pass
1. Add true side-by-side conflict merge UI for queued profile/admin drafts when local and server values differ.
2. Add thumbnail upload progress bars and multi-file bulk replace for equipment evidence assets.
3. Add automated deploy smoke-check execution in CI/CD so release verification is not manual.
4. Expand diagnostics collection into per-module success/failure timing for deeper startup tracing.
