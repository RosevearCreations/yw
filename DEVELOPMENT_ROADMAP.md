# Development Roadmap

Last refreshed: **2026-05-18b**

## Completed in this pass

- Added visible per-panel retry controls for Command Center, Health, Staff, Jobs, and Accounting.
- Added a dedicated `command_center` fast path before heavier Admin panel requests.
- Added Admin scope timing/status cards for live load visibility.
- Added schema **115** to track panel retry/timing guardrails and report delivery bundle readiness.
- Updated smoke checks, schema reference, and active Markdown.
- Reconfirmed one-H1 rule and CSS brace balance.

## Next logical 20 steps

1. Add a small Admin diagnostics drawer that expands the panel timing cards into request details.
2. Persist failed Admin panel loads into `admin_panel_load_diagnostics` through an Edge Function write path.
3. Add stale-data age badges directly to each panel header.
4. Convert Accounting subpanels into smaller `accounting_close`, `banking`, and `tax_payroll` scopes.
5. Convert Safety/Evidence Manager into a separate `evidence` fast path.
6. Add filtered export buttons for Staff and Jobs views.
7. Add role-safe confirmation dialogs for Complete, Cancel, Reopen, and Add Note actions.
8. Add schema preflight checks before showing Admin actions that depend on newer migrations.
9. Add a guided deployment checklist screen using frontend quality gates and schema drift data.
10. Add a mobile supervisor dashboard using existing `admin_mobile_action_card_directory` rows.
11. Add offline queue badges beside Admin action buttons.
12. Add close blocker explanations beside every Guided Close step.
13. Add bank CSV import preview and validation before posting to reconciliation staging.
14. Add evidence retry assignment, due date, and completion status fields.
15. Add backup rehearsal evidence upload and signoff fields.
16. Add local SEO route rows for each public route and service page.
17. Add structured metadata checks to `repo-smoke-check.mjs`.
18. Add a CSS drift report for oversized mobile tables and overflowing buttons.
19. Add sitemap/robots validation to smoke checks.
20. Add a release health summary table to `NEW_CHAT_STATUS.md` on every pass.

## Following 20 steps after that

1. Deprecate the Admin `all` scope after all panels have dedicated scopes.
2. Split `js/admin-ui.js` into Admin People, Operations, Health, and Accounting modules.
3. Add skeleton loaders for every Admin panel.
4. Add DB-backed default page-size and sort preferences per admin user.
5. Add stronger Supabase RLS tests for Admin-only views and actions.
6. Add a migration preflight script that checks missing tables/columns before view creation.
7. Add a view dependency report for every schema file.
8. Normalize job statuses into a lookup table and map old/new variants.
9. Add undo-safe notes for job action changes.
10. Add payroll close blockers to the Guided Close Center.
11. Add sales tax filing preview/signoff screens.
12. Add accountant handoff package manifest generation.
13. Add evidence attachment counts to Admin row cards.
14. Add worker mobile task completion shortcuts.
15. Add Search Console-style public route tracking placeholders.
16. Add image alt-text completeness checks for public routes.
17. Add mobile tap-target checks for navigation and Admin buttons.
18. Add public content freshness tracking for local landing pages.
19. Add structured-data JSON-LD validation for public business/service pages.
20. Add a one-page release checklist automatically linked from each ZIP handoff.
