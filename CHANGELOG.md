# Changelog

Last refreshed: **2026-05-15c**

## 2026-05-15c

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

## Deploy notes

- Apply SQL through schema **109**.
- Redeploy changed Supabase functions: `admin-directory`, `admin-manage`.
- Clear/hard refresh the service worker cache after deployment.
