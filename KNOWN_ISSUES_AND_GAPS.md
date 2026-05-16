# Known Issues and Gaps

Last refreshed: **2026-05-15c**

## Highest priority after this pass

1. **Apply schema 109 live.** The new pagination, close-step action, audit, backup rehearsal, bank CSV staging, evidence action, and mobile action tables/views need to exist before the new Admin panels fully populate.
2. **Redeploy `admin-directory` and `admin-manage`.** Admin now loads schema 109 views and writes close-step/evidence/audit actions.
3. **Server-side pagination is founded but not fully wired.** DB settings and response metadata exist; table UI still needs page controls and count queries.
4. **Guided Close Center can complete/reopen steps, but owner/due editing is still next.** Blocker drill-down still needs to open exact source queues.
5. **Bank CSV import has DB staging only.** Upload, preview, duplicate comparison, and accept/reject row controls are next.
6. **Audit log exists, but not every write action records to it yet.** New close/evidence actions log events; older actions should be expanded.
7. **Evidence action queue exists, but real retry/replace/archive handlers are still next.** Current action queue records follow-up intent.
8. **Mobile action cards exist, but worker/supervisor mobile dashboard screens are still next.** Offline outbox integration remains important.
9. **Backup/restore rehearsal table exists, but a real restore rehearsal still needs to be performed and documented.**
10. **SEO smoke table exists, but public-page scanning is not automated yet.** This should be wired when marketing pages are introduced.

## Recently addressed

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

## Watch items after deploy

- Confirm Admin Health shows schema **109** current.
- Confirm Guided Close Center Complete/Reopen buttons write events.
- Confirm Evidence Manager follow-up creates both a health note and an evidence action queue row.
- Confirm readiness panel shows bank CSV import, backup rehearsal, mobile action card, and audit rows.
- Confirm browser cache is not still loading older `2026-05-15b` assets.
