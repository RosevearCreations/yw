# YWI Safety, Jobs, Accounting, and Admin App

Last refreshed: **2026-05-18b**

This build is the current app package for the YWI operations backend. It includes HSE forms, worker profile screens, Jobs/Operations, Admin command-center workflows, accounting close support, reporting, and mobile-friendly navigation.

## Current pass focus

- Added visible Admin panel retry buttons for Command Center, Health, People, Operations, and Accounting.
- Split the first Admin load into a lighter `command_center` fast path plus staged `health`, `people`, `operations`, and `accounting` panel calls.
- Added frontend timing/status cards so Admin shows which panel loaded live, which failed, and how long each scope took.
- Kept the emergency `scope: all` fallback only for cases where every staged request fails.
- Confirmed `report-subscription-delivery-run` uses escaped newline strings so the Edge Function bundles cleanly.
- Updated schema tracking through **115** and refreshed all active Markdown.

## Deployment reminders

1. Apply SQL migrations through `sql/115_admin_panel_retry_timing_and_command_scope.sql`.
2. Redeploy Supabase Edge Functions: `admin-directory`, `admin-manage`, and `report-subscription-delivery-run`.
3. Deploy the static site and hard refresh/unregister the service worker so browsers load `2026-05-18b` assets.
4. Open `#admin`, confirm staged panel timing cards show live results, then test Retry Health, Retry Accounting, Refresh Staff Only, and Refresh Jobs Only.

## Active documentation

- `PROJECT_STATE.md` — current build state.
- `NEW_CHAT_STATUS.md` — quick handoff for the next chat.
- `DEVELOPMENT_ROADMAP.md` — completed work and next 20 steps.
- `KNOWN_ISSUES_AND_GAPS.md` — live risks and remaining gaps.
- `DATABASE_STRUCTURE.md` — current schema marker and migration notes.
- `DEPLOYMENT_GUIDE.md` — deployment checklist.
- `TESTING_CHECKLIST.md` — smoke checks and manual checks.
- `SYSTEM_ARCHITECTURE.md` — frontend, Edge Function, and DB structure.
- `AI_CONTEXT.md` — working context for future AI passes.
