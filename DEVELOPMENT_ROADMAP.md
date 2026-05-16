# Development Roadmap

Last refreshed: **2026-05-15b**

## Completed or advanced in this pass

1. Added schema 108 for saved filters, close wizard step metadata, health resolution notes, deployment gate checks, and SEO smoke checks.
2. Updated canonical schema reference and smoke checks through schema 108.
3. Fixed `renderAdminHealthCenter()` so schema drift data is defined before it is rendered.
4. Added Admin saved-view controls: name, scope, shared flag, save, use, and delete.
5. Added `admin_saved_filter` write actions in `admin-manage` for create, update, touch/use, and delete.
6. Added saved-filter scope summaries so managers can see which areas have reusable views.
7. Added Guided Close Center step cards mapped to accounting entities.
8. Added DB-backed close workflow step metadata for period review, payments, bank review, tax/payroll, journal preview, and accountant package delivery.
9. Added health-resolution notes table and Edge Function actions for health/evidence follow-up notes.
10. Added Resolve buttons to Admin Health rows where source IDs are available.
11. Added Evidence Manager follow-up buttons that create resolution/follow-up records.
12. Added deployment gate table and Admin action to mark deployment gates passed.
13. Added public SEO smoke-check table foundation for page title, H1 count, local terms, meta description, alt coverage, and broken assets.
14. Added Admin UI rendering for deployment gates and SEO smoke rows.
15. Added `admin-directory` loading for schema 108 views.
16. Added CSS polish for saved views, row actions, deployment gate rows, and mobile wrapping.
17. Removed active temp files again.
18. Retired old root Markdown into the archive again and created a fresh Markdown snapshot.
19. Bumped cache/build version to `2026-05-15b`.
20. Verified JavaScript syntax, smoke checks, and one-H1 status.

## Next logical 20 steps after this pass

1. Convert saved filters from section jumps into true query/state restore for every major admin table.
2. Add server-side pagination and page-size controls to people, jobs, accounting, health, evidence, and reports lists.
3. Turn Guided Close Center step cards into a real wizard with step status, owner, due date, blocker drill-down, and completion notes.
4. Add journal posting preview UI with debit/credit balance checks, source links, locked-period checks, and approval requirements.
5. Build bank CSV import UI with upload session, duplicate detection, preview, accepted/rejected row counts, and import history.
6. Build reconciliation manual review controls: accept match, reject match, manual match, split match, and reviewer notes.
7. Expand payment application forms for partial payment, overpayment, unapplied amount, reversal, void, and audit reason.
8. Build accountant package generator with manifest index, GL detail, trial balance, AR/AP aging, sales tax, payroll, reconciliation, and receipts.
9. Add file/package delivery tracking with sent/reviewed/finalized/confirmed states and delivery evidence.
10. Add media completeness scoring to Evidence Manager for job photos, HSE proof, receipt images, signatures, and upload failures.
11. Add true retry/replace/archive controls for failed uploads and evidence rows.
12. Add worker mobile dashboard: clock in/out, assigned forms, training/SDS, offline outbox, and help contact.
13. Add supervisor daily dashboard: active crews, no-show/late risk, evidence review, incidents, payroll exceptions, and route execution.
14. Add persistent health workflow: assign, dismiss, retry, resolve, dead-letter note, and reopen.
15. Add audit log viewer for auth, roles, posting, close/reopen, exports, approvals, settings, and health resolutions.
16. Add backup/restore scripts and a restore rehearsal checklist with date, operator, result, and next action.
17. Add CI/deploy gate automation so syntax, smoke, H1, schema marker, service worker version, and changed Edge Functions are checked before packaging.
18. Add public-page SEO automation when marketing pages are introduced: title/meta/H1/local words/alt/broken assets.
19. Add role-by-role permission enforcement tests for admin, supervisor, HSE, job admin, and employee.
20. Add final production sign-off screen with RLS, CORS, env vars, backups, schema drift, monitoring, rate limits, roles, recovery, and deployment gates.

## SEO rule kept during this pass

Keep one clear H1 per exposed page. Use words people search for in titles, main headings, alt text, and helpful link text. For local discovery, keep service area wording accurate and visible. Local ranking still depends on relevance, distance, and prominence.

References:
- Google Search Essentials: https://developers.google.com/search/docs/essentials
- Google title-link guidance: https://developers.google.com/search/docs/appearance/title-link
- Google Business Profile local ranking: https://support.google.com/business/answer/7091
