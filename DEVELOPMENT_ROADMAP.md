# Development Roadmap

Last refreshed: **2026-05-20a**

## Completed in this pass

- Added schema **118** for Admin preflight registry, deployment checklist rendering, and function readiness tracking.
- Updated Admin startup so it loads `command_center` first, then uses `v_admin_fast_path_scope_registry` to decide the remaining staged initial scopes when available.
- Kept the hard-coded staged scope list as a fallback when schema/function deployment is behind.
- Kept the broad `scope: all` call only as an emergency fallback if every staged panel fails.
- Updated `admin-directory` so Command Center and Health payloads return:
  - `admin_fast_path_scope_registry`
  - `admin_action_confirmation_rules`
  - `admin_deployment_checklist`
  - `admin_function_readiness_checks`
- Added deployment checklist rendering to the Production Readiness panel.
- Added function readiness rendering to the Production Readiness panel.
- Added readiness rows for `admin-directory`, `admin-manage`, `report-subscription-delivery-run`, and `service-execution-scheduler-run`.
- Updated schema reference, smoke checks, active Markdown, archive snapshots, and cache version.
- Reconfirmed the exposed app shell has one H1 and balanced CSS braces.

## Next logical 20 steps

1. Add role-aware disabled states for Admin buttons before the user clicks, not only confirmation prompts after the click.
2. Add per-panel retry/backoff rules so repeatedly failing Admin panels do not hammer Edge Functions.
3. Add a visible schema preflight card that names missing tables/views before action buttons are rendered.
4. Add a “function readiness last checked” timestamp and operator signoff field.
5. Add Admin action permissions to the DB registry so the UI can hide/disable controls by role and workflow.
6. Add CSV exports for Staff Directory and Jobs with current filters applied.
7. Add evidence action assignment, due date, completion, and owner filters.
8. Add bank CSV import preview rows before accepting records into reconciliation staging.
9. Add close blocker explanation text beside every Guided Close Center step.
10. Add backup rehearsal evidence upload/signoff fields.
11. Add offline queue badges beside Admin action buttons.
12. Add mobile supervisor dashboard cards from `admin_mobile_action_card_directory`.
13. Add smoke-check validation for sitemap, robots, title, H1, meta description, and missing image alt text.
14. Add structured-data JSON-LD checks for local business/service pages.
15. Add public route freshness rows for local landing pages.
16. Add service-area content proof fields so local SEO pages only mention real coverage.
17. Split `js/admin-ui.js` into smaller modules after the split scope pattern is stable.
18. Add RLS/function permission test notes to every Admin action document.
19. Add one release checklist file per ZIP handoff.
20. Add a simple Admin deploy dashboard that links schema version, function readiness, cache version, and smoke checks.

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
