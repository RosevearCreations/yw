# Development Roadmap

Last refreshed: **2026-05-28a**

## Completed in this pass

- Added schema **122** for mobile form steppers, local draft-resume chips, and phone-form quality gates.
- Added `js/mobile-form-helper.js` as a reusable helper for Toolbox Talk, PPE, First Aid, Incident / Near Miss, Site Inspection, and Drill forms.
- Added phone step chips, Back/Next navigation, Save Draft, Resume Draft, and Clear actions for common field forms.
- Added local-device draft counts to the Today dashboard and mobile quick-action badge totals.
- Updated `js/mobile-menu.js` and `js/mobile-today.js` so saved local drafts are visible beside queued submissions/actions.
- Updated Admin readiness loading and rendering for mobile form stepper registry and form quality gates.
- Updated `server-worker.js`, `index.html`, and cache marker to **2026-05-28a**.
- Kept visible Ontario **OHSA** / Ontario workplace-safety wording, while moving old root Markdown into archive.
- Reconfirmed one-H1 discipline, JavaScript syntax, CSS brace balance, and smoke-check coverage.

## Next logical 20 steps

1. Add camera/photo attachment quality checks before upload on mobile.
2. Add image compression and upload retry progress for phone photos.
3. Add Today dashboard live data cards from `admin_mobile_action_card_directory` for supervisors/admins.
4. Add Today dashboard role ordering preferences saved per user.
5. Add offline queue detail drawer from the Today dashboard.
6. Add conflict review shortcuts for queued admin/action items from the Today dashboard.
7. Add push-notification readiness placeholders for overdue training, corrective actions, and job updates.
8. Add mobile deep links from notifications into the exact form/action row.
9. Add supervisor mobile approve/follow-up/return-for-correction card actions.
10. Add evidence owner/due/status/source filters optimized for phone screens.
11. Add close-step blocker explanations as mobile cards instead of only table rows.
12. Add function readiness signoff buttons for deploy verification.
13. Add schema metadata verifier to update `admin_schema_preflight_checks.live_status` from live database metadata.
14. Add CSV exports for Staff and Jobs using current filters/sorts.
15. Add bank CSV preview rows before accepting reconciliation records.
16. Add public SEO smoke checks for sitemap, robots, title, H1, meta description, alt text, and structured data.
17. Add local service-area proof fields so local pages only mention real coverage.
18. Split `js/admin-ui.js` into smaller modules once the split-scope registry is stable.
19. Add mobile support snapshot export with queued items, drafts, panel status, and browser/service-worker details.
20. Add server-side saved draft sync after local-device draft behavior is stable and permission rules are clear.

## Following 20 steps after that

1. Build a true mobile worker task inbox with today, overdue, drafts, and pending-sync tabs.
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
19. Add module-level JS splitting for Today, Admin, Jobs, Reports, and Safety Ops.
20. Add release comparison snapshots that show schema/docs/code changes per build.
