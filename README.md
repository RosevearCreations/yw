# YWI Main App

Last refreshed: **2026-05-20b**

Current build label: `yw-main-129-updated-2026-05-20b-admin-action-preflight-retry.zip`

Current schema marker: **119**

Current asset/cache version: `2026-05-20b`

## Current pass summary

This pass continues the Admin production-readiness work by adding DB-backed action permissions, schema preflight rows, and panel retry/backoff policy rows. The Admin UI now renders those rows in Production Readiness and uses the action-permission registry to disable known risky buttons for roles that should not run them.

## What changed

- Added `sql/119_admin_action_permissions_preflight_and_retry_rules.sql`.
- Updated `sql/000_full_schema_reference.sql` through schema 119.
- Added Admin Production Readiness tables for:
  - schema preflight checks,
  - action permission registry,
  - panel retry/backoff policy.
- Updated `admin-directory` to return the new readiness arrays and `actor_role` for role-aware UI decisions.
- Added role-aware disabled states for known Admin action buttons:
  - job complete/cancel,
  - job note,
  - close step complete/reopen,
  - deployment gate update,
  - evidence follow-up.
- Updated mobile/table CSS and bumped the service worker cache version.
- Archived the previous Markdown snapshot and moved retired root Markdown out of the active root again.

## Deploy checklist

1. Apply SQL through **schema 119**.
2. Redeploy Supabase function `admin-directory`.
3. Redeploy `admin-manage` if the live copy is not already current.
4. Hard refresh or unregister the browser service worker so `2026-05-20b` assets load.
5. Open Admin > Readiness and confirm schema preflight, action permissions, retry policies, deployment checklist, and function readiness tables populate.

## Active handoff files

- `PROJECT_STATE.md`
- `NEW_CHAT_STATUS.md`
- `DEVELOPMENT_ROADMAP.md`
- `KNOWN_ISSUES_AND_GAPS.md`
- `DATABASE_STRUCTURE.md`
- `SYSTEM_ARCHITECTURE.md`
- `DEPLOYMENT_GUIDE.md`
- `TESTING_CHECKLIST.md`
- `AI_CONTEXT.md`
- `CHANGELOG.md`
