# New Chat Status

Last refreshed: **2026-05-20a**

## Current build state

- Current output label: `2026-05-20a`.
- Latest schema marker: **118**.
- Main focus: Admin preflight/readiness UI, DB-backed fast-path scope registry, deployment checklist rows, and function readiness rows.
- Emergency fallbacks remain: hard-coded staged scope list and broad `scope: all` if every staged panel fails.

## Must-do after upload/deploy

1. Apply migrations through `sql/118_admin_preflight_registry_deployment_checklist_ui.sql`.
2. Redeploy `admin-directory`.
3. Redeploy `admin-manage` if not already on the latest schema 117/118 action handling.
4. Redeploy `report-subscription-delivery-run` if the live function still has bundle/escaping errors.
5. Hard refresh or unregister the service worker so `2026-05-20a` assets load.
6. Open Admin and verify:
   - staged Command Center first load
   - DB-backed fast-path registry payload
   - deployment checklist table
   - function readiness table
   - one-H1 public app shell
   - mobile Admin layout remains usable

## Next work starts from

Use `DEVELOPMENT_ROADMAP.md` and `KNOWN_ISSUES_AND_GAPS.md`. The next priority is role-aware disabled states and per-panel retry/backoff rules so failing panels do not get hammered repeatedly.
