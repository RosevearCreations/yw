# Development Roadmap

Last refreshed: **2026-05-18a**

## Completed in this pass

- Reworked Admin initial load to use staged panel scopes.
- Preserved the heavy `all` Admin scope only as an emergency fallback.
- Added schema 114 to track the staged load and cache fallback guardrails.
- Updated active docs, smoke checks, schema reference, and cache version.

## Next logical 20 steps

1. Add visible per-panel retry buttons for Health, People, Operations, and Accounting.
2. Move Admin Home command cards to a dedicated `command_center` fast path if live load still feels slow.
3. Add frontend timing metrics for each Admin scope request.
4. Store Admin panel load failures in a small diagnostics table for review.
5. Add user-facing stale-data age badges on each Admin panel.
6. Finish server-side paging for remaining large Admin lists.
7. Add filtered export buttons for Staff and Jobs views.
8. Add role-safe write guards around every Admin row action.
9. Add live schema compatibility checks before showing actions that depend on newer tables.
10. Add a guided deployment checklist screen using schema gate data.
11. Build a small mobile supervisor dashboard from the existing mobile action cards.
12. Add offline queue status badges to Admin action buttons.
13. Add accounting close blocker explanations beside each close step.
14. Add bank CSV import preview/validation before posting to reconciliation staging.
15. Add evidence retry assignment and due-date fields.
16. Add backup rehearsal result upload/evidence fields.
17. Add local SEO page audit rows for each public route.
18. Add structured page metadata checks to the smoke script.
19. Add a CSS drift report for oversized mobile tables and overflowing buttons.
20. Add a release health summary to `NEW_CHAT_STATUS.md` on every pass.

## Following 20 steps after that

1. Convert `admin-directory` all-scope response into a deprecated compatibility path.
2. Create separate frontend modules for Admin People, Admin Operations, and Admin Accounting.
3. Add skeleton loaders for each Admin panel so partial loads feel intentional.
4. Add an Admin diagnostics drawer showing last request status per scope.
5. Add persistent panel preferences for default page sizes and sort order.
6. Add stronger Supabase RLS tests for Admin-only views.
7. Add a DB migration preflight script that checks missing columns before applying views.
8. Add a view dependency report for schema files.
9. Add job status normalization lookup table and map old/new statuses.
10. Add job action confirmation dialogs with undo-safe notes.
11. Add payroll close readiness blockers to the close center.
12. Add sales tax filing export preview and sign-off state.
13. Add accountant handoff package manifest generation.
14. Add document/evidence attachment counts to Admin row cards.
15. Add field-worker mobile task completion shortcuts.
16. Add Search Console-style public route tracking placeholders.
17. Add sitemap/robots validation to smoke checks.
18. Add image alt-text completeness checks for public pages.
19. Add mobile tap-target checks for key navigation and Admin buttons.
20. Add a one-page release checklist for each ZIP handoff.
