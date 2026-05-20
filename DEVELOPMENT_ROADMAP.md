# Development Roadmap

Last refreshed: **2026-05-19a**

## Completed in this pass

- Added an expandable **Admin panel diagnostics drawer** inside App Health and Schema Center.
- Added mobile-safe **stale-data age badges** for Command Center, Health, Staff, Jobs, and Accounting panel loads.
- Added frontend persistence for failed staged Admin panel loads into `admin_panel_load_diagnostics` through `admin-manage`.
- Added `admin-manage` support for `entity: admin_panel_load_diagnostic`.
- Updated `admin-directory` so Health/all scopes return `v_admin_panel_load_diagnostics`.
- Added schema **116** for diagnostics drawer quality gates, stale age checks, and persisted panel failure tracking.
- Updated CSS for phone layouts so diagnostics rows and badges stack instead of creating horizontal overflow.
- Refreshed schema reference, smoke checks, active Markdown, archive snapshots, and cache version.
- Reconfirmed the exposed app shell has one H1 and balanced CSS braces.

## Next logical 20 steps

1. Split the Accounting fast path into `accounting_close`, `banking`, and `tax_payroll` scopes.
2. Split Safety/Evidence Manager into a separate `evidence` fast path.
3. Add skeleton loaders for Command Center, Health, Staff, Jobs, Accounting, and Evidence panels.
4. Add role-safe confirmation dialogs for Complete, Cancel, Reopen, Resolve, and Add Note actions.
5. Add schema preflight warnings before showing actions that depend on newer migrations.
6. Add a guided deployment checklist screen using schema drift, frontend gates, and function readiness rows.
7. Add mobile supervisor dashboard cards using existing `admin_mobile_action_card_directory` rows.
8. Add offline queue badges beside Admin action buttons that can sync later.
9. Add close blocker explanations beside every Guided Close step.
10. Add bank CSV import preview and validation before posting to reconciliation staging.
11. Add evidence retry assignment, due date, and completion fields to the UI.
12. Add backup rehearsal evidence upload and signoff fields.
13. Add filtered CSV export buttons for Staff and Jobs views.
14. Add local SEO route rows for each public service/location page.
15. Add structured metadata checks to `repo-smoke-check.mjs`.
16. Add a CSS drift report for oversized mobile tables and overflowing buttons.
17. Add sitemap and robots validation to smoke checks.
18. Add release health summary tables to `NEW_CHAT_STATUS.md` every pass.
19. Add public route freshness tracking for local landing pages.
20. Add image alt-text completeness checks for public routes.

## Following 20 steps after that

1. Deprecate the Admin `all` scope after all major panels have dedicated fast paths.
2. Split `js/admin-ui.js` into Admin People, Operations, Health, Accounting, and Safety modules.
3. Add DB-backed default page-size and sort preferences per admin user.
4. Add RLS test notes for every Admin-only view and action.
5. Add a migration preflight script that checks missing tables/columns before view creation.
6. Add a view dependency report for every schema file.
7. Normalize job statuses into a lookup table and map old/new variants.
8. Add undo-safe notes for job action changes.
9. Add payroll close blockers to the Guided Close Center.
10. Add sales tax filing preview/signoff screens.
11. Add accountant handoff package manifest generation.
12. Add evidence attachment counts to Admin row cards.
13. Add worker mobile task completion shortcuts.
14. Add Search Console-style public route tracking placeholders.
15. Add structured-data JSON-LD validation for public business/service pages.
16. Add mobile tap-target checks for navigation and Admin buttons.
17. Add public content freshness tracking reminders for every service area page.
18. Add service-area proof fields for local SEO pages.
19. Add customer-facing service FAQs with one-H1 checks.
20. Add a one-page release checklist automatically linked from each ZIP handoff.
