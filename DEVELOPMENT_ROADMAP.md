# Development Roadmap

Last refreshed: **2026-05-16b**

## Completed or advanced in this pass

1. Added Staff Directory search controls for name, email, phone, position, trade, supervisor, and admin text matching.
2. Added Staff Directory role filter for all roles, employee, supervisor, and admin.
3. Added Staff Directory page-size selector with 10, 25, 50, and 100 row choices.
4. Added Staff Directory Previous and Next controls with a visible page label.
5. Added Admin UI pagination state for people and jobs.
6. Updated `loadDirectory()` so Admin sends people page, page size, search, and role filter to `admin-directory`.
7. Updated `admin-directory` to return `pagination_meta.people` with page, page size, total, total pages, loaded count, search, and role filter.
8. Updated Admin user count so it can display the filtered total from pagination metadata instead of only loaded rows.
9. Added `safeListPaged()` in `admin-directory` for safer paged reads with count metadata.
10. Added a paged jobs query path using `jobs_page`, `jobs_page_size`, and `jobs_search`.
11. Added `pagination_meta.jobs` so the jobs backend path is ready for the next Operations table controls.
12. Added mobile-friendly CSS for Admin list toolbar controls.
13. Updated saved admin view payloads to include Staff Directory search, role filter, and page size.
14. Updated saved admin view replay so pressing **Use** restores section, queue filters, catalog/backbone hints, and Staff Directory filters.
15. Added schema **111**: `111_admin_directory_pagination_saved_view_replay.sql`.
16. Updated `v_schema_drift_status` to expect schema 111.
17. Added frontend/backend quality gates for Staff Directory pagination, pagination metadata, saved-view replay, and cache version `2026-05-16b`.
18. Updated `sql/000_full_schema_reference.sql` through schema 111.
19. Updated `scripts/repo-smoke-check.mjs` to verify schema 111, pagination controls, saved-view replay, and Edge Function pagination metadata.
20. Re-archived Markdown snapshots, removed retired root Markdown, removed temp files, refreshed active Markdown, and kept the one-H1/mobile SEO rule in place.

## Next logical 20 steps after this pass

1. Add visible paged controls to the Jobs/Operations backbone table using the new `pagination_meta.jobs` foundation.
2. Add sort selectors to Staff Directory: name, email, role, status, last login, and created/updated date where available.
3. Move people filtering from in-memory filtering toward true SQL-side paging for admin users to reduce DB read cost on large teams.
4. Add direct Edge Function fast paths for `scope: people` and `scope: operations` so Admin does not need `scope: all` for every small refresh.
5. Add a “Refresh this panel only” button for People, Operations, Accounting, Health, and Evidence sections.
6. Add owner and due-date editing to Guided Close Center steps with assignment dropdowns and validation.
7. Add close blocker drill-down buttons that open the exact reconciliation, tax, payroll, payment, journal, or evidence list.
8. Build journal posting preview UI with debit/credit lines, out-of-balance warning, approval state, and locked-period checks.
9. Build bank CSV upload UI with preview, duplicate detection, accepted/rejected rows, and import session notes.
10. Add reconciliation review actions: accept match, reject match, manual match, split match, and reviewer notes.
11. Expand AR/AP payment application forms for partial payments, overpayments, unapplied amounts, reversals, voids, and audit reasons.
12. Build accountant package generator screen with manifest, GL detail, trial balance, AR/AP aging, sales tax, payroll, reconciliation, and receipts.
13. Add accountant package delivery tracking with sent, reviewed, finalized, confirmed, failed, and evidence states.
14. Wire evidence action queue items to real upload handlers for retry, replace, archive, dismiss, and reopen.
15. Add media completeness scoring to Evidence Manager for job photos, HSE proof, receipt images, signatures, and failed uploads.
16. Build worker mobile dashboard screens for clock in/out, assigned forms, training/SDS, offline outbox, and help contact.
17. Build supervisor daily dashboard for active crews, late/no-show risk, evidence review, incidents, payroll exceptions, and route execution.
18. Expand persistent health workflow with assign, dismiss, retry, resolve, reopen, dead-letter notes, and audit logging.
19. Add backup/export scripts and record a real restore rehearsal result in the backup rehearsal table.
20. Add public-page SEO automation for future marketing pages: title, meta, one H1, locality words, alt text, broken assets, canonical routes, and mobile usability.

## SEO rule kept during this pass

Keep one clear H1 per exposed page. Use words people search for in titles, main headings, alt text, and helpful link text. Keep mobile layout clean because Google uses the mobile version for indexing/ranking. For local discovery, keep service-area wording accurate and visible; local ranking is mainly tied to relevance, distance, and prominence.

References:
- Google Search Essentials: https://developers.google.com/search/docs/essentials
- Google title-link guidance: https://developers.google.com/search/docs/appearance/title-link
- Google Business Profile local ranking: https://support.google.com/business/answer/7091
- Google mobile-first indexing: https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing
