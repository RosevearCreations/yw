# New Chat Status

Last refreshed: **2026-05-19b**

## Current build state

- Current output label: `2026-05-19b`.
- Latest schema marker: **117**.
- Main focus: split Admin fast paths, Evidence Manager fast path, confirmation guardrails, and mobile-safe loading skeletons.
- The broad `all` and `accounting` scopes remain emergency fallbacks only.

## Must-do after upload/deploy

1. Apply migrations through `sql/117_split_admin_scopes_confirmation_and_deployment_checklist.sql`.
2. Redeploy `admin-directory` and `admin-manage`.
3. Hard refresh or unregister the service worker so `2026-05-19b` assets load.
4. Open Admin and verify these cards load or show retry status: Command Center, Health, People, Operations, Accounting Close, Banking, Tax/Payroll, Evidence.
5. Test phone width for menu, Admin scope cards, Evidence Manager, Jobs review table, and Guided Close Center.

## Next work starts from

Use `DEVELOPMENT_ROADMAP.md` and `KNOWN_ISSUES_AND_GAPS.md`. The next priority is rendering the new deployment checklist rows and adding schema/function preflight warnings before showing actions that depend on new migrations.
