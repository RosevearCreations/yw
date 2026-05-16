# Development Roadmap

Last refreshed: **2026-05-16a**

## Completed or advanced in this pass

1. Added a compact mobile main-menu toggle in `index.html` so phones no longer load a long list of navigation pills by default.
2. Added `js/mobile-menu.js` to manage open/close state, `aria-expanded`, current-section label, outside-click close, Escape close, and route-change sync.
3. Added mobile CSS for a two-column expanded menu, one-column fallback on very narrow screens, scroll-safe menu height, and touch-friendly 44px controls.
4. Updated the service worker app shell to cache `js/mobile-menu.js` and bumped the static cache to `2026-05-16a`.
5. Converted the Admin section menu into a compact expandable phone menu with a current-section label.
6. Kept the Admin section pills visible and wrapped on desktop while hiding them behind a single toggle on small screens.
7. Added mobile header polish so the title, session name, and buttons do not crowd the top of the screen.
8. Added schema 110 as a safe frontend quality-gate marker for mobile navigation, one-H1, cache version, and active Markdown readiness.
9. Added `app_frontend_quality_gates` and `v_mobile_navigation_quality_gates` for DB-backed UI quality tracking.
10. Updated `v_schema_drift_status` to expect schema 110.
11. Updated `admin-directory` to load `v_mobile_navigation_quality_gates` when schema 110 is present.
12. Updated the canonical schema reference through schema 110.
13. Updated the repo smoke check to require the mobile menu file, mobile menu script reference, mobile CSS collapse rules, compact Admin section toggle, schema 110, and the updated archive path.
14. Archived the current Markdown snapshot under `archive/markdown-current-snapshot-2026-05-16a/`.
15. Retired reintroduced root Markdown files back into `archive/markdown-retired-2026-05-16a/`.
16. Removed reintroduced `test_write` temporary files from the active root.
17. Verified the exposed app shell still has exactly one H1.
18. Kept the SEO title/description direction intact while improving mobile usability for mobile-first indexing.
19. Updated all active root Markdown handoff files for the mobile UX/schema 110 pass.
20. Updated docs with a mobile navigation/responsive UX note and refreshed the roadmap/gaps for the next pass.

## Next logical 20 steps after this pass

1. Add true server-side pagination to `admin-directory` for people and jobs using page, page size, search, and sort parameters.
2. Add reusable Admin table pagination controls: previous/next, page size, visible count, search, and saved sort.
3. Add saved-filter replay so saved views restore section, filters, search, sort, page size, and focused entity.
4. Build Guided Close Center owner and due-date editing with assignment dropdowns and validation.
5. Add blocker drill-down buttons so each close blocker opens its exact accounting or evidence queue.
6. Build journal posting preview UI with debit/credit lines, out-of-balance warning, approval state, and locked-period checks.
7. Build bank CSV upload UI with preview, duplicate detection, accepted/rejected rows, and import session notes.
8. Add reconciliation review actions: accept match, reject match, manual match, split match, and reviewer notes.
9. Expand AR/AP payment application forms for partial payments, overpayments, unapplied amounts, reversals, voids, and audit reasons.
10. Build an accountant package generator screen with manifest, GL detail, trial balance, AR/AP aging, sales tax, payroll, reconciliation, and receipts.
11. Add accountant package delivery tracking with sent, reviewed, finalized, confirmed, failed, and evidence states.
12. Wire evidence action queue items to real upload handlers for retry, replace, archive, dismiss, and reopen.
13. Add media completeness scoring to Evidence Manager for job photos, HSE proof, receipt images, signatures, and failed uploads.
14. Build worker mobile dashboard screens for clock in/out, assigned forms, training/SDS, offline outbox, and help contact.
15. Build supervisor daily dashboard for active crews, late/no-show risk, evidence review, incidents, payroll exceptions, and route execution.
16. Expand persistent health workflow with assign, dismiss, retry, resolve, reopen, dead-letter notes, and audit logging.
17. Expand audit logging across every `admin-manage` write action and show filters by actor, entity, action, and date.
18. Add backup/export scripts and record a real restore rehearsal result in the backup rehearsal table.
19. Add CI/deploy gate automation for syntax, smoke, H1, schema marker, service-worker version, changed Edge Functions, and SQL files.
20. Add public-page SEO automation for future marketing pages: title, meta, one H1, locality words, alt text, broken assets, canonical routes, and mobile usability.

## SEO rule kept during this pass

Keep one clear H1 per exposed page. Use words people search for in titles, main headings, alt text, and helpful link text. Keep mobile layout clean because Google uses the mobile version for indexing/ranking. For local discovery, keep service-area wording accurate and visible; local ranking is mainly tied to relevance, distance, and prominence.

References:
- Google Search Essentials: https://developers.google.com/search/docs/essentials
- Google title-link guidance: https://developers.google.com/search/docs/appearance/title-link
- Google Business Profile local ranking: https://support.google.com/business/answer/7091
- Google mobile-first indexing: https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing
