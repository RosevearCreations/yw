# Project State

Last refreshed: **2026-05-20a**

## Build label

`yw-main-128-updated-2026-05-20a-admin-preflight-registry.zip`

## Schema

Latest schema marker: **118**

New migration:

- `sql/118_admin_preflight_registry_deployment_checklist_ui.sql`

## Main work completed

- Added Admin deployment checklist rendering in Production Readiness.
- Added Admin function readiness rendering in Production Readiness.
- Updated `admin-directory` so Command Center/Health can return:
  - `v_admin_fast_path_scope_registry`
  - `v_admin_action_confirmation_rules`
  - `v_admin_deployment_checklist`
  - `v_admin_function_readiness_checks`
- Changed Admin startup to load `command_center` first and then use the DB-backed fast-path scope registry when available.
- Kept a hard-coded fallback scope list and `scope: all` emergency fallback for safety.
- Archived current Markdown snapshots and retired old root Markdown from the active root.
- Removed recurring `test_write` temp files.
- Bumped cache version to `2026-05-20a`.
- Verified public app shell still has one H1.

## Deploy reminders

Apply SQL through schema 118, redeploy `admin-directory`, then hard refresh the browser/service worker cache.
