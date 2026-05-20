# YWI / Rosie Dazzlers Operations App

Last refreshed: **2026-05-19b**

This build continues moving the site and backend toward a real production app: smaller Admin payloads, safer mobile controls, stronger diagnostics, cleaner schema tracking, and clearer deployment handoff notes.

## Current focus

- Admin now loads through staged panel scopes instead of relying on one large request.
- Accounting is being split into Accounting Close, Banking/Reconciliation, and Tax/Payroll paths.
- Evidence Manager now has its own fast path and retry control.
- Status-changing Admin actions now ask for confirmation before changing live data.
- Active Markdown and schema files are kept current every pass; older root Markdown is archived out of the active root.

## Deploy checklist

1. Apply SQL through `sql/117_split_admin_scopes_confirmation_and_deployment_checklist.sql`.
2. Redeploy Supabase functions, especially `admin-directory` and `admin-manage`.
3. Deploy the updated static site files.
4. Hard refresh or unregister the service worker so `2026-05-19b` assets load.
5. Open `#admin` on desktop and phone width and confirm split scope cards show live or retry status.

## Active handoff docs

- `DEVELOPMENT_ROADMAP.md`
- `KNOWN_ISSUES_AND_GAPS.md`
- `NEW_CHAT_STATUS.md`
- `DATABASE_STRUCTURE.md`
- `SYSTEM_ARCHITECTURE.md`
- `DEPLOYMENT_GUIDE.md`
- `TESTING_CHECKLIST.md`
- `AI_CONTEXT.md`
