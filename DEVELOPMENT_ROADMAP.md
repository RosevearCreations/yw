# Development Roadmap

Last refreshed: **2026-05-20b**

## Completed in this pass

- Added schema **119** for Admin action permissions, schema preflight rows, retry/backoff policy, and function readiness signoff fields.
- Updated `admin-directory` so Admin payloads can include `actor_role`, action permission rows, panel retry policy rows, and schema preflight rows.
- Updated Admin Production Readiness to render:
  - schema preflight checks,
  - action permission registry,
  - panel retry/backoff policy,
  - enriched function readiness rows with last checked/signoff columns.
- Added role-aware disabled states for known risky Admin action buttons:
  - job complete/cancel,
  - job note,
  - close step complete/reopen,
  - deployment gate update,
  - evidence follow-up.
- Updated CSS for disabled buttons and mobile readiness tables.
- Updated canonical schema, smoke checks, active Markdown, archive snapshot, and cache version.
- Reconfirmed the exposed app shell has one H1 and balanced CSS braces.

## Next logical 20 steps

1. Add Admin UI write/edit controls for `admin_action_permission_registry` so role rules can be adjusted without SQL.
2. Add Admin UI write/edit controls for `admin_panel_retry_policy` so cooldown/backoff can be tuned live.
3. Add a real schema-object verifier that updates `admin_schema_preflight_checks.live_status` from database metadata.
4. Add function readiness signoff buttons for operators to record deploy verification timestamps.
5. Add per-panel retry counters in the browser so the UI respects the DB retry policy instead of only displaying it.
6. Add CSV export for Staff Directory using the current search/filter/sort.
7. Add CSV export for Jobs using the current search/filter/sort.
8. Add evidence assignment, due date, completion, and owner filters.
9. Add bank CSV import preview rows before accepting records into reconciliation staging.
10. Add close blocker explanation text beside every Guided Close Center step.
11. Add backup rehearsal evidence upload/signoff fields.
12. Add offline queue badges beside Admin action buttons.
13. Add mobile supervisor dashboard cards from `admin_mobile_action_card_directory`.
14. Add smoke-check validation for sitemap, robots, title, H1, meta description, and missing image alt text.
15. Add structured-data JSON-LD checks for local business/service pages.
16. Add public route freshness rows for local landing pages.
17. Add service-area content proof fields so local SEO pages only mention real coverage.
18. Split `js/admin-ui.js` into smaller modules after the split scope and registry patterns are stable.
19. Add RLS/function permission test notes to every Admin action document.
20. Add one release checklist file per ZIP handoff.

## Following 20 steps after that

1. Add an Admin deploy dashboard linking schema version, function readiness, cache version, and smoke checks.
2. Deprecate broad Admin `accounting` fallback after split accounting scopes pass live testing.
3. Deprecate broad Admin `all` fallback after every major panel has a dedicated fast path.
4. Add server-side page/sort/filter preferences per Admin user.
5. Normalize job statuses into a lookup table and migrate legacy status variants.
6. Add undo-safe job status/action history in the Jobs review table.
7. Add payroll close blockers to the Guided Close Center.
8. Add sales tax filing preview/signoff screens.
9. Add accountant handoff package manifest generation.
10. Add evidence attachment counts and source previews to Admin row cards.
11. Add worker mobile task completion shortcuts.
12. Add Search Console-style public route tracking placeholders.
13. Add customer-facing service FAQs with one-H1 checks.
14. Add local review/testimonial proof blocks for location pages.
15. Add image completeness scoring for public gallery/service images.
16. Add automatic alt-text missing row exports for content cleanup.
17. Add service worker stale-cache warning banner for Admin users.
18. Add backup restore rehearsal reminders and evidence attachments.
19. Add monthly accountant export dry-run testing.
20. Add staging-vs-production schema drift comparison notes.
