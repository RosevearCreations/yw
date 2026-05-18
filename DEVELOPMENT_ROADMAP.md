# Development Roadmap

Last refreshed: **2026-05-17b**

## Completed or advanced in this pass

1. Added Staff Directory panel-only refresh button using the `people` Edge Function scope.
2. Added Jobs/Operations panel-only refresh button using the `operations` Edge Function scope.
3. Added shared `refreshAdminPanelScope()` frontend handler so panels can refresh without reloading all Admin data.
4. Added reusable Admin directory paging payload builder for Staff and Jobs filters.
5. Added partial-response merge logic so fast-path Edge responses update only the relevant Admin state.
6. Changed Staff search/apply/previous/next controls to refresh only the Staff panel.
7. Changed Jobs search/apply/previous/next controls to refresh only the Jobs/Operations panel.
8. Added a separate Jobs review table above the generic backbone editor.
9. Added job row actions for Open, Complete, Cancel, and Add Note.
10. Added mobile-friendly stacked row actions for Jobs review on phone widths.
11. Added `admin-manage` support for job status updates from the Admin Jobs table.
12. Added `admin-manage` support for job notes using `job_comments`.
13. Added site-activity logging for job status updates and job notes.
14. Added early `operations` fast path in `admin-directory` before the full people directory is loaded.
15. Added early `health` / `command_center` fast path in `admin-directory`.
16. Added early `accounting` fast path in `admin-directory` for close-center refreshes.
17. Removed `client_name` from Jobs search columns to avoid failures when live `jobs` does not contain that column.
18. Added schema 113 for panel refresh preferences, job action audit foundations, and quality gates.
19. Updated smoke checks for panel-refresh buttons, Jobs review table, Edge fast paths, schema 113, cleanup, and archives.
20. Refreshed active Markdown, schema reference, cache version, one-H1/CSS checks, and archive cleanup for the release.

## Next logical 20 steps after this pass

1. Move Staff Directory filtering fully SQL-side by creating a DB view/RPC that joins profile access rollups before paging.
2. Add role-safe SQL-side filters for Staff status, site assignment, supervisor, trade, position, and active/blocked state.
3. Add a real Operations job detail drawer so Open shows job summary, crew, schedule, evidence, invoices, and notes in one compact panel.
4. Add direct Assign Supervisor and Assign Admin actions to the Jobs review table.
5. Add due-date and owner editing to Guided Close Center steps.
6. Add close blocker drill-down buttons that open reconciliation, tax, payroll, payment, journal, or evidence rows directly.
7. Build journal posting preview UI with debit/credit lines, approval status, out-of-balance warnings, and locked-period checks.
8. Build bank CSV upload/preview UI with duplicate detection, accepted/rejected staging rows, and import session notes.
9. Add reconciliation actions: accept match, reject match, manual match, split match, and reviewer notes.
10. Expand AR/AP payment screens for partial payments, overpayments, unapplied amounts, reversals, voids, and audit reasons.
11. Build accountant package generator screen with manifest, GL detail, trial balance, AR/AP aging, sales tax, payroll, reconciliation, and receipts.
12. Add accountant package delivery tracking with sent, reviewed, finalized, confirmed, failed, and evidence states.
13. Wire Evidence action queue to real retry, replace, archive, dismiss, and reopen handlers.
14. Add media completeness scoring to Evidence Manager for photos, receipts, signatures, HSE proof, and failed uploads.
15. Build worker mobile dashboard screens for clock in/out, assigned forms, training/SDS, offline outbox, and help contact.
16. Build supervisor daily dashboard for active crews, late/no-show risk, evidence review, incidents, payroll exceptions, and route execution.
17. Expand persistent health workflow with assign, dismiss, retry, resolve, reopen, dead-letter notes, and audit logging.
18. Add backup/export scripts and record a real restore rehearsal result in the backup rehearsal table.
19. Add public-page SEO automation for title, meta, one H1, locality words, alt text, broken assets, canonical routes, and mobile usability.
20. Add release gate automation that blocks deploy if schema marker, cache version, Edge Function list, CSS braces, or smoke checks are out of sync.

## SEO/mobile rule kept during this pass

Keep one clear H1 per exposed page. Use words people search for in titles, main headings, alt text, and helpful link text. Keep mobile and desktop content aligned because Google uses the mobile version for indexing/ranking. For local discovery, keep service-area wording accurate and visible; local ranking is mainly tied to relevance, distance, and prominence.

References:
- Google Search Essentials: https://developers.google.com/search/docs/essentials
- Google title-link guidance: https://developers.google.com/search/docs/appearance/title-link
- Google Business Profile local ranking: https://support.google.com/business/answer/7091
- Google mobile-first indexing: https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing
