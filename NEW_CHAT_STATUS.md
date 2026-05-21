# New Chat Status

Last refreshed: **2026-05-20b**

Use this as the starting point for the next chat.

## Latest build

`yw-main-129-updated-2026-05-20b-admin-action-preflight-retry.zip`

## Latest completed pass

- Added schema **119**.
- Added Admin action permission registry.
- Added Admin schema preflight checks.
- Added Admin panel retry/backoff policy.
- Added function readiness signoff metadata fields.
- Updated Admin UI to render the new readiness tables.
- Updated `admin-directory` to return new readiness arrays and `actor_role`.
- Disabled known risky Admin action buttons when the actor role does not meet the registry requirement.
- Refreshed active Markdown and schema reference.
- Bumped cache version to `2026-05-20b`.

## First things to do after deploy

1. Apply SQL through schema 119.
2. Redeploy `admin-directory`.
3. Hard refresh / unregister service worker.
4. Open Admin > Readiness.
5. Confirm these tables are visible:
   - Schema Preflight,
   - Action Permissions,
   - Panel Retry Policy,
   - Deployment Checklist,
   - Function Readiness.
6. Test with a non-admin or lower-role account to confirm unsafe buttons show disabled instead of waiting until click.

## Watch for

- Cached `2026-05-20a` assets hiding the new UI.
- Schema 119 not applied before redeploy testing.
- Action buttons disabled for a role that should actually be allowed; fix that in `admin_action_permission_registry` rather than hard-coding the UI.
