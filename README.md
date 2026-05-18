# YWI Operations App

Current build: **2026-05-17b**

This build continues moving the app toward a production-style operations backend. The main pass added panel-only Admin refreshes, a mobile-friendly Jobs review table, direct job note/status actions, schema 113 tracking, and refreshed active Markdown.

## Deploy checklist

1. Apply SQL through `sql/113_admin_panel_refresh_and_job_review_actions.sql`.
2. Redeploy Supabase functions:
   - `admin-directory`
   - `admin-manage`
3. Deploy the static app.
4. Clear or unregister the old service worker cache.
5. Run `node scripts/repo-smoke-check.mjs`.
6. Test Admin on desktop and phone width.

## Active planning docs

- `DEVELOPMENT_ROADMAP.md`
- `KNOWN_ISSUES_AND_GAPS.md`
- `DATABASE_STRUCTURE.md`
- `SYSTEM_ARCHITECTURE.md`
- `DEPLOYMENT_GUIDE.md`
- `TESTING_CHECKLIST.md`
- `NEW_CHAT_STATUS.md`
