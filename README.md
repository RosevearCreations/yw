# YWI Main App

Last refreshed: **2026-05-20a**

This build focuses on making the Admin app more production-ready by showing deployment/preflight state directly in the Admin Readiness panel and reducing hard-coded Admin startup assumptions.

## Current state

- Current asset/cache version: `2026-05-20a`.
- Latest schema marker: **118**.
- Admin startup now loads `command_center` first, then reads the DB-backed fast-path scope registry when available.
- Production Readiness now renders deployment checklist rows and function readiness rows.
- The broad `all` Admin scope remains only as an emergency fallback.
- Public app shell still has one H1.

## Deploy order

1. Apply SQL through `sql/118_admin_preflight_registry_deployment_checklist_ui.sql`.
2. Redeploy Supabase functions:
   - `admin-directory`
   - `admin-manage`
   - `report-subscription-delivery-run` if not already redeployed after the newline/CSV escaping fix.
3. Deploy the static site files.
4. Hard refresh or unregister the service worker so `2026-05-20a` assets load.
5. Open `#admin`, then check Command Center, Health, Readiness, Staff, Jobs, Accounting, and Evidence panels.

## Active docs

- `PROJECT_STATE.md` — current build state.
- `NEW_CHAT_STATUS.md` — handoff for the next chat/pass.
- `DEVELOPMENT_ROADMAP.md` — completed work and next steps.
- `KNOWN_ISSUES_AND_GAPS.md` — remaining risks and gaps.
- `DATABASE_STRUCTURE.md` — schema marker and database notes.
- `DEPLOYMENT_GUIDE.md` — deploy order and cache notes.
- `TESTING_CHECKLIST.md` — manual and smoke checks.
- `SYSTEM_ARCHITECTURE.md` — current app structure.
- `AI_CONTEXT.md` — compact orientation file for future work.
