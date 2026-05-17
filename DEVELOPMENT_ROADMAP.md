# Development Roadmap

Last refreshed: **2026-05-17a**

## Completed or advanced in this pass

1. Added Staff Directory sort selector for name, email, role, status, last login, created date, and updated date.
2. Added Staff Directory sort direction control.
3. Sent `people_sort` and `people_sort_dir` from Admin UI to `admin-directory`.
4. Added sanitized people sort handling in `admin-directory`.
5. Returned Staff Directory sort metadata through `pagination_meta.people`.
6. Added visible Jobs/Operations search controls in the Admin Operations panel.
7. Added visible Jobs/Operations sort selector for job code, job name, status, priority, start date, and updated date.
8. Added visible Jobs/Operations sort direction control.
9. Added Jobs/Operations page-size selector.
10. Added Jobs/Operations Previous and Next controls.
11. Added Jobs/Operations page label showing loaded range and total rows.
12. Sent `jobs_search`, `jobs_sort`, `jobs_sort_dir`, `jobs_page`, and `jobs_page_size` to `admin-directory`.
13. Added sanitized jobs sort handling in `admin-directory`.
14. Returned Jobs/Operations sort metadata through `pagination_meta.jobs`.
15. Added a narrow `scope: operations` Edge Function fast path for smaller operations refreshes.
16. Added a narrow `scope: people` Edge Function fast path for smaller people refreshes.
17. Expanded saved admin views so they now replay both Staff Directory filters and Jobs/Operations filters.
18. Improved mobile table/list toolbar CSS so Staff and Jobs controls wrap cleanly on phones.
19. Added schema **112**: `112_admin_operations_pagination_sorting_panel_refresh.sql`.
20. Updated smoke checks, active Markdown, schema reference, cache version, archive snapshot, one-H1 checks, and cleanup rules for the `2026-05-17a` release.

## Next logical 20 steps after this pass

1. Wire **Refresh this panel only** buttons to call `scope: people`, `scope: operations`, `scope: health`, `scope: accounting`, and `scope: reporting` without refreshing all Admin data.
2. Move Staff Directory filtering from in-memory merged arrays to SQL-side paging where role/scope rules allow it.
3. Add a visible Operations jobs table separate from the backbone record picker so jobs can be reviewed without changing the manager entity.
4. Add direct job row actions: open, complete, cancel, assign supervisor, assign admin, and add note.
5. Add close-step owner and due-date editing in Guided Close Center.
6. Add close blocker drill-down buttons that open the matching reconciliation, tax, payroll, payment, journal, or evidence list.
7. Build journal posting preview UI with debit/credit lines, out-of-balance warning, approval state, and locked-period checks.
8. Build bank CSV upload UI with preview, duplicate detection, accepted/rejected rows, and import session notes.
9. Add reconciliation review actions: accept match, reject match, manual match, split match, and reviewer notes.
10. Expand AR/AP payment application screens for partial payments, overpayments, unapplied amounts, reversals, voids, and audit reasons.
11. Build accountant package generator screen with manifest, GL detail, trial balance, AR/AP aging, sales tax, payroll, reconciliation, and receipts.
12. Add accountant package delivery tracking with sent, reviewed, finalized, confirmed, failed, and evidence states.
13. Wire evidence action queue items to real upload handlers for retry, replace, archive, dismiss, and reopen.
14. Add media completeness scoring to Evidence Manager for job photos, HSE proof, receipt images, signatures, and failed uploads.
15. Build worker mobile dashboard screens for clock in/out, assigned forms, training/SDS, offline outbox, and help contact.
16. Build supervisor daily dashboard for active crews, late/no-show risk, evidence review, incidents, payroll exceptions, and route execution.
17. Expand persistent health workflow with assign, dismiss, retry, resolve, reopen, dead-letter notes, and audit logging.
18. Add backup/export scripts and record a real restore rehearsal result in the backup rehearsal table.
19. Add public-page SEO automation for future marketing pages: title, meta, one H1, locality words, alt text, broken assets, canonical routes, and mobile usability.
20. Add release gate automation that blocks deploy if schema marker, service-worker cache version, Edge Function list, CSS brace count, or smoke checks are out of sync.

## SEO/mobile rule kept during this pass

Keep one clear H1 per exposed page. Use words people search for in titles, main headings, alt text, and helpful link text. Keep mobile and desktop content aligned because Google uses the mobile version for indexing/ranking. For local discovery, keep service-area wording accurate and visible; local ranking is mainly tied to relevance, distance, and prominence.

References:
- Google Search Essentials: https://developers.google.com/search/docs/essentials
- Google title-link guidance: https://developers.google.com/search/docs/appearance/title-link
- Google Business Profile local ranking: https://support.google.com/business/answer/7091
- Google mobile-first indexing: https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing
