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
