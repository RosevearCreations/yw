# Development Roadmap

Last refreshed: **2026-05-15c**

## Completed or advanced in this pass

1. Added schema 109 for pagination settings, guided close actions, admin audit events, backup/restore rehearsals, bank CSV import staging, evidence action queue, and mobile action cards.
2. Updated the canonical schema reference and smoke checks through schema 109.
3. Added owner, due date, blocker override, completion notes, completed-by, and completed-at fields to guided close workflow steps.
4. Added close-step event history so complete/reopen/update actions leave an audit trail.
5. Added Admin UI close-step detail table with Complete and Reopen actions.
6. Added admin-manage support for guided close step complete/reopen/update actions.
7. Added admin audit events table and directory view for auth, roles, posting, close/reopen, exports, approvals, settings, and health-resolution logging.
8. Added Admin UI audit log table in the readiness panel.
9. Added DB-backed list pagination settings for people, jobs, accounting close, health/evidence, and reports payloads.
10. Added admin-directory pagination metadata so the next UI pass can send list scope, search, page size, and sort state.
11. Added bank CSV import session and row staging tables with row counts, duplicate status, accepted/rejected counts, and import notes.
12. Added Admin UI bank CSV import status table.
13. Added backup/restore rehearsal tracking with planned restore rehearsal seed rows.
14. Added Admin UI backup/restore rehearsal table.
15. Added evidence action queue table for follow-up, retry, replace, archive, and blocked evidence workflows.
16. Updated Evidence Manager to queue evidence follow-up actions while still creating health-resolution notes.
17. Added worker/supervisor mobile action card table for clocking, assigned forms, help contact, supervisor daily dashboard, and evidence review.
18. Added Admin UI mobile action-card table for production-readiness planning.
19. Cleaned recurring active-root drift by archiving current Markdown, retiring old root Markdown, and removing test_write temp files again.
20. Bumped cache/build version to 2026-05-15c and verified JavaScript syntax, smoke checks, CSS additions, and one-H1 status.

## Next logical 20 steps after this pass

1. Wire true server-side pagination into admin-directory for people first, then jobs, accounting, health/evidence, and reports.
2. Add page controls to Admin tables: page size, previous/next, total count, search, and saved sort state.
3. Finish saved-filter state replay so saved views restore section, table filters, search, sort, page size, and focused entity.
4. Add owner/due-date editing to Guided Close Center steps with assignment dropdowns and date validation.
5. Add blocker drill-down for each close step so clicking a blocker opens the exact accounting queue.
6. Build journal posting preview UI with generated debit/credit lines, out-of-balance warning, approval status, and locked-period checks.
7. Build bank CSV upload UI that creates import sessions, previews rows, detects duplicates, and lets rows be accepted/rejected before reconciliation.
8. Add reconciliation manual review buttons: accept match, reject match, manual match, split match, and reviewer notes.
9. Expand AR/AP payment application forms for partial payments, overpayments, unapplied amounts, reversals, voids, and audit reasons.
10. Build accountant package generator screen with manifest, GL detail, trial balance, AR/AP aging, sales tax, payroll, reconciliation, and receipts.
11. Add accountant package delivery tracking with sent, reviewed, finalized, confirmed, failed, and evidence states.
12. Wire evidence action queue to real upload handlers for retry, replace, archive, dismiss, and reopen.
13. Add media completeness scoring to Evidence Manager for job photos, HSE proof, receipt images, signatures, and upload failures.
14. Build worker mobile dashboard with clock in/out, assigned forms, training/SDS, offline outbox, and help contact.
15. Build supervisor daily dashboard for active crews, late/no-show risk, evidence review, incidents, payroll exceptions, and route execution.
16. Expand persistent health workflow with assign, dismiss, retry, resolve, reopen, and dead-letter notes.
17. Expand audit logging across every admin-manage write action and show filters by actor, entity, action, and date.
18. Add backup/export scripts and record a real restore rehearsal result in the new rehearsal table.
19. Add CI/deploy gate automation so syntax, smoke, H1, schema marker, service-worker version, changed Edge Functions, and SQL files are checked before packaging.
20. Add public-page SEO automation for future marketing pages: title, meta, one H1, locality words, alt text, broken assets, and canonical route checks.

## SEO rule kept during this pass

Keep one clear H1 per exposed page. Use words people search for in titles, main headings, alt text, and helpful link text. For local discovery, keep service-area wording accurate and visible. Local ranking still depends on relevance, distance, and prominence.

References:
- Google Search Essentials: https://developers.google.com/search/docs/essentials
- Google title-link guidance: https://developers.google.com/search/docs/appearance/title-link
- Google Business Profile local ranking: https://support.google.com/business/answer/7091
