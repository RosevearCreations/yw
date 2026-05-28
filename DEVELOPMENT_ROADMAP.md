# Development Roadmap

Last refreshed: **2026-05-27a**

## Completed in this pass

- Added schema **121** for the mobile Today dashboard, PWA install helper, quick-action queue badges, and mobile action registry.
- Added the `#today` route and made it the default app/PWA start screen.
- Added `js/mobile-today.js` for role-aware Today cards, online/offline status, queued form/action counts, and install guidance.
- Expanded the bottom mobile quick-action bar to **Today, Talk, Incident, Safety, Jobs, and Admin**.
- Added live quick-action badges for queued form submissions and queued admin/action items.
- Updated `js/outbox.js` so form/action queue changes notify the mobile UI immediately.
- Updated `manifest.json` so installed phone users open directly on `/#today`.
- Updated `js/router.js` and `js/security.js` so the Today route is available to every signed-in role.
- Updated Admin readiness loading to include mobile Today and PWA install quality-gate views.
- Updated visible copy to continue using Ontario **OHSA** and workplace-safety wording for Ontario procedures.
- Added mobile CSS for Today cards, install helper, queue badges, and the six-button quick bar.
- Updated the service worker app shell for `js/mobile-today.js` and cache version `2026-05-27a`.
- Archived older Markdown snapshots, moved retired root Markdown out of the active root again, and removed recurring temp files.
- Reconfirmed one-H1 discipline, JavaScript syntax, CSS brace balance, and smoke-check coverage.

## Next logical 20 steps

1. Add mobile form steppers for Toolbox Talk, Incident / Near Miss, PPE, First Aid, Inspection, and Drill screens.
2. Add one-tap draft save/resume chips beside each mobile form.
3. Add camera/photo attachment quality checks before upload on mobile.
4. Add image compression and upload retry progress for phone photos.
5. Add Today dashboard live data cards from `admin_mobile_action_card_directory` when the user has supervisor/admin access.
6. Add Today dashboard role ordering preferences saved per user.
7. Add offline queue detail drawer from the Today dashboard.
8. Add conflict review shortcuts for queued admin/action items from the Today dashboard.
9. Add push-notification readiness placeholders for overdue training, corrective actions, and job updates.
10. Add mobile deep links from notifications into the exact form/action row.
11. Add supervisor mobile approve/follow-up/return-for-correction card actions.
12. Add evidence owner/due/status/source filters optimized for phone screens.
13. Add close-step blocker explanations as mobile cards instead of only table rows.
14. Add function readiness signoff buttons for deploy verification.
15. Add schema metadata verifier to update `admin_schema_preflight_checks.live_status` from live database metadata.
16. Add CSV exports for Staff and Jobs using current filters/sorts.
17. Add bank CSV preview rows before accepting reconciliation records.
18. Add public SEO smoke checks for sitemap, robots, title, H1, meta description, alt text, and structured data.
19. Add local service-area proof fields so local pages only mention real coverage.
20. Split `js/admin-ui.js` into smaller modules once the split-scope registry is stable.

## Following 20 steps after that

1. Build a true mobile worker task inbox with today, overdue, and pending-sync tabs.
2. Add route/job start checklist shortcuts with large tap targets.
3. Add geofence/weather/context cards on the Today dashboard.
4. Add mobile signature-capture review improvements.
5. Add accessibility checks for touch target size, contrast, labels, and keyboard focus.
6. Add server-side page/sort/filter preferences per Admin user.
7. Normalize job statuses into a lookup table and migrate legacy status variants.
8. Add undo-safe job status/action history in the Jobs review table.
9. Add payroll close blockers to the Guided Close Center.
10. Add sales tax filing preview/signoff screens.
11. Add accountant handoff package manifest generation.
12. Add evidence attachment counts and source previews to Admin row cards.
13. Add customer-facing service FAQs with one-H1 checks.
14. Add local review/testimonial proof blocks for location pages.
15. Add image completeness scoring for public gallery/service images.
16. Add staging-vs-production schema drift comparison notes.
17. Add per-role onboarding checklists for phone users.
18. Add app install analytics events for installed vs browser sessions.
19. Add a mobile support snapshot export that includes queued items and panel status.
20. Add module-level JS splitting for Today, Admin, Jobs, Reports, and Safety Ops.
