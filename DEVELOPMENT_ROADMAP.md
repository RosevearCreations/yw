# Development Roadmap

Last refreshed: **2026-05-19b**

## Completed in this pass

- Split the staged Admin startup into smaller panel scopes: `accounting_close`, `banking`, `tax_payroll`, and `evidence`.
- Added dedicated `admin-directory` fast paths for Accounting Close, Banking/Reconciliation, Tax/Payroll, and Evidence Manager data.
- Added a Retry Evidence button and Evidence stale-data age badge so the evidence queue can be refreshed without reloading the full Admin manager.
- Added confirmation guardrails before status-changing actions: job complete/cancel, close-step complete/reopen, health resolve, deployment gate update, and evidence follow-up.
- Added lightweight Admin skeleton loading state so staged mobile loads look intentional rather than frozen.
- Fixed a small Admin markup drift issue in the Production Readiness permissions table.
- Removed recurring retired root Markdown and `test_write` files from the active root again while preserving archive snapshots.
- Added schema **117** for split Admin scope tracking, confirmation guardrails, deployment checklist rows, and updated schema drift status.
- Updated schema reference, smoke checks, active Markdown, archive snapshots, and cache version.
- Reconfirmed the exposed app shell has one H1 and balanced CSS braces.

## Next logical 20 steps

1. Make Admin startup fully configurable from `v_admin_fast_path_scope_registry` instead of hard-coded JavaScript arrays.
2. Render the new `v_admin_deployment_checklist` rows directly in the Production Readiness panel.
3. Add per-panel retry/backoff rules so repeatedly failing panels do not hammer Edge Functions.
4. Add a schema preflight card that warns before rendering actions that depend on missing views/tables.
5. Add a small “function readiness” table for `admin-directory`, `admin-manage`, report delivery, and scheduler functions.
6. Add role-aware disabled states for buttons instead of only showing confirmation prompts.
7. Add CSV exports for Staff Directory and Jobs with current filters applied.
8. Add evidence action assignment, due date, and completion fields to the Evidence Manager UI.
9. Add bank CSV import preview rows before writing to reconciliation staging.
10. Add close blocker explanation text beside each Guided Close Center step.
11. Add backup rehearsal evidence upload/signoff fields.
12. Add offline queue badges beside Admin action buttons.
13. Add mobile supervisor dashboard cards from `admin_mobile_action_card_directory`.
14. Add smoke-check validation for sitemap, robots, title, H1, meta description, and missing image alt text.
15. Add structured-data JSON-LD checks for local business/service pages.
16. Add public route freshness rows for local landing pages.
17. Add service-area content proof fields so local SEO pages only mention real coverage.
18. Split `js/admin-ui.js` into smaller Admin modules after the split scopes settle.
19. Add RLS/function permission test notes to every Admin action document.
20. Add one release checklist file per ZIP handoff.

## Following 20 steps after that

1. Deprecate the broad Admin `accounting` fallback after split accounting scopes pass live testing.
2. Deprecate the broad Admin `all` fallback after every major panel has a dedicated fast path.
3. Add server-side page/sort/filter preferences per Admin user.
4. Normalize job statuses into a lookup table and migrate legacy status variants.
5. Add undo-safe job status/action history in the Jobs review table.
6. Add payroll close blockers to the Guided Close Center.
7. Add sales tax filing preview/signoff screens.
8. Add accountant handoff package manifest generation.
9. Add evidence attachment counts and source previews to Admin row cards.
10. Add worker mobile task completion shortcuts.
11. Add Search Console-style public route tracking placeholders.
12. Add customer-facing service FAQs with one-H1 checks.
13. Add local review/testimonial proof blocks for location pages.
14. Add image completeness scoring for public gallery/service images.
15. Add automatic alt-text missing row exports for content cleanup.
16. Add service worker stale-cache warning banner for Admin users.
17. Add backup restore rehearsal reminders and evidence attachments.
18. Add monthly accountant export dry-run testing.
19. Add staging-vs-production schema drift comparison notes.
20. Add a release dashboard that links schema, docs, checks, and deploy notes in one place.
