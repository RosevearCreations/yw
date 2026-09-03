# Yard Weasels Build 191 Release Authority

## Build 191 — Admin account recovery and current-readiness cleanup

Build 191 is the current bounded release candidate after Build 190. Its release scope is account recovery/security and Admin readiness truth only.

### Verified implementation

- Password inputs provide an eyeball control that shows or hides only the value currently present in the browser field.
- Existing Supabase passwords are not retrievable or displayable; no Build 191 table, view, log, or API stores or returns plaintext passwords or authentication hashes.
- An Admin may set an active user's temporary password without knowing the user's existing password. The password is passed only to the server-side Supabase Admin Auth update.
- Every Admin-issued temporary reset is audited in `admin_password_resets` without password material.
- A temporary reset sets `profiles.password_reset_required=true`; normal module loading remains fail-closed through the existing account-setup gate until the user saves a permanent password.
- The user clears that gate only after their authenticated password update succeeds and `admin-account-security` records the change.
- Admin > Account Security lists current accounts and exposes the temporary-password workflow only to Admin.
- Admin > I.T. current To-Do shows only unresolved current requirements. Completed rails and superseded preflight/prerelease instructions remain queryable as historical audit evidence but are not active To-Do work.

### Source acceptance

The exact Build 191 application candidate `f58ff155bfadc93d4752e8d8fe732cdc7972d546` passed PR #49 workflow Run #185 / `33790314523` end-to-end, including all static, runtime, Finance, repository, navigation, and rendered browser suites.

This release-authority document is the only source change after that accepted application candidate. A fresh full PR gate is required on the final documentation SHA before promotion.

### Live database and Edge authority

- Live database: Schema `191 / 191` CURRENT.
- `ywi_admin_account_security_assertions()`: `8 / 8 PASS` after live migration.
- `admin-account-security`: ACTIVE v1 with JWT verification enabled.
- Reset audit rows created during release: `0`.
- Profiles forced into temporary-password reset during release: `0`.
- No real user's password was modified as part of release validation.

### Current Admin To-Do truth

Build 191 preserves all genuine unresolved business evidence. The current queue contains:

- 11 human/provider/accounting/content business acceptance rails;
- 3 current security follow-ups;
- 1 repository-enforcement follow-up.

The 11 business rails remain separately evidence-gated and are not auto-closed by Build 191. Completed Build, schema, preflight, prerelease, and superseded deployment reminders are retained as audit history rather than shown as current work.

### Non-negotiable release boundaries

- Finance posting execution remains OFF.
- Provider/payment mutation remains OFF.
- No business acceptance rail is auto-closed.
- Existing passwords remain one-way/non-readable.
- Temporary passwords are never persisted or echoed by Build 191.
- Production promotion remains deliberate/manual.
- Repository enforcement remains separately AMBER until main branch protection/ruleset enforcement is verified.

### Promotion order

Build 191 is complete only after the final source SHA passes the full gate, that exact candidate is promoted to `dev` and verified, the same source is merged to `main` and exact-main CI is GREEN, release-source evidence is recorded, the Build 191 technical rail is closed with immutable evidence, and stale feature branches are removed while retaining current `dev` and `main`.

Do not start Build 192 before `dev` and `main` are both current on the completed Build 191 source tree.
