# Development Roadmap

Last refreshed: **2026-05-26a**

## Completed in this pass

- Added schema **120** for Ontario OHSA wording gates and mobile-first quality gates.
- Replaced visible U.S. safety wording with Ontario OHSA / Ontario workplace safety wording.
- Updated the app title, meta description, H1, manifest, HSE Ops labels, Admin hub copy, and Reports subtitle.
- Added a fixed mobile quick-action bar for Toolbox Talk, Incident, Safety Ops, Jobs, and Admin.
- Updated `js/mobile-menu.js` so the mobile quick bar tracks the active route.
- Added phone-friendly CSS for the quick bar, mobile card spacing, and stacked action buttons.
- Updated `admin-directory` to expose mobile-first and Ontario wording gate views.
- Added `docs/ONTARIO_OHSA_AND_MOBILE_FIRST_APP_PASS.md`.
- Updated canonical schema, smoke checks, active Markdown, archive snapshot, and cache version.
- Reconfirmed the exposed app shell has one H1 and balanced CSS braces.

## Next logical 20 steps

1. Build a role-aware mobile Today dashboard that shows the next 3–5 actions for worker, supervisor, admin, and accounting roles.
2. Add offline queue count badges to the mobile quick-action bar.
3. Add a PWA install helper card for phone users, including iOS and Android install notes.
4. Add mobile form stepper layouts for Toolbox Talk, Incident / Near Miss, Site Inspection, PPE, First Aid, and Drill forms.
5. Add one-tap draft save and resume chips for incomplete mobile field submissions.
6. Add camera/photo attachment quality checks before upload on phone.
7. Add mobile-friendly evidence assignment filters: owner, due date, status, and source.
8. Add supervisor mobile card actions for approve, follow up, and return for correction.
9. Add browser retry counters that enforce `admin_panel_retry_policy` instead of only displaying the policy.
10. Add Admin edit screens for `admin_action_permission_registry` and `admin_panel_retry_policy`.
11. Add a schema-object verifier that updates `admin_schema_preflight_checks.live_status` from database metadata.
12. Add function readiness signoff buttons for deploy verification.
13. Add CSV exports for Staff and Jobs using current filters/sorts.
14. Add bank CSV import preview rows before accepting reconciliation records.
15. Add close blocker explanation text beside every Guided Close Center step.
16. Add backup rehearsal evidence upload/signoff fields.
17. Add smoke-check validation for sitemap, robots, title, H1, meta description, missing alt text, and mobile quick-nav presence.
18. Add structured-data JSON-LD checks for public service/location pages.
19. Add service-area content proof fields so local pages only mention real coverage.
20. Split `js/admin-ui.js` into smaller modules once the split-scope registry is stable.

## Following 20 steps after that

1. Add a true mobile worker task inbox with today, overdue, and pending-sync tabs.
2. Add push-notification readiness placeholders for mobile reminders.
3. Add mobile deep links from notifications into the correct form/action row.
4. Add role-specific home screen ordering preferences saved per user.
5. Add route/job start checklist shortcuts with large tap targets.
6. Add geofence/weather/context cards on the mobile Today dashboard.
7. Add image compression and upload retry status for phone photos.
8. Add mobile signature-capture review improvements.
9. Add accessibility checks for touch target size, contrast, labels, and keyboard focus.
10. Add server-side page/sort/filter preferences per Admin user.
11. Normalize job statuses into a lookup table and migrate legacy status variants.
12. Add undo-safe job status/action history in the Jobs review table.
13. Add payroll close blockers to the Guided Close Center.
14. Add sales tax filing preview/signoff screens.
15. Add accountant handoff package manifest generation.
16. Add evidence attachment counts and source previews to Admin row cards.
17. Add customer-facing service FAQs with one-H1 checks.
18. Add local review/testimonial proof blocks for location pages.
19. Add image completeness scoring for public gallery/service images.
20. Add staging-vs-production schema drift comparison notes.
