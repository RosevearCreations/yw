# Development Roadmap

Last refreshed: **2026-05-14b**

## Completed or advanced in this pass

1. Repaired schema 106 so `app_schema_versions` exists before command/health views read it.
2. Repaired schema 106 to use `jobs.status` instead of assuming `jobs.job_status` exists.
3. Added schema 107 for schema drift, readiness checks, saved filters, permission matrix, close overview, and evidence manager foundations.
4. Updated `admin-directory` so job loading no longer fails on missing `job_status`.
5. Added Command Center drill-down hints for operations, safety, accounting, and health sections.
6. Added Guided Close Center read-only cards.
7. Added Evidence Manager read-only cards and table.
8. Added Production Readiness and Permissions panel.
9. Added schema drift status in Admin Health.
10. Added role permission matrix seed data.
11. Added production readiness seed checks.
12. Added saved-filter table foundation.
13. Updated smoke checks through schema 107.
14. Removed active temp files.
15. Archived current Markdown snapshots before replacing active docs.
16. Moved retired root Markdown back into archive.
17. Moved legacy pass docs out of the active `docs/` root.
18. Refreshed active Markdown with cleaner current handoff notes.
19. Bumped app/cache version to `2026-05-14b`.
20. Verified the exposed app shell still has only one `<h1>`.

## Next logical 20 steps after this pass

1. Wire Command Center cards to exact saved filters and focused entity rows, not just broad route/section jumps.
2. Add write endpoints for saved admin filters so each manager can save personal/shared views.
3. Convert the Guided Close Center from a read-only overview into a step-by-step wizard.
4. Add posting preview actions that validate debit/credit balance, source links, locked periods, and approvals before creating journal batches.
5. Build the bank CSV import UI with duplicate detection, preview, accepted/rejected row counts, and import sessions.
6. Build the reconciliation manual review screen with accept/reject/manual-match controls and reviewer notes.
7. Build payment application detail forms for partial payments, overpayments, unapplied amounts, reversal, and void handling.
8. Generate accountant export bundles with package index plus GL detail, trial balance, AR/AP aging, tax, payroll, reconciliation, and receipts.
9. Add upload retry/replace/archive controls to the Evidence Manager.
10. Add image/media completeness scoring into the Evidence Manager for job/HSE/receipt proof.
11. Add server-side pagination to every large admin list before more payloads are added.
12. Add saved filter presets per role: admin, supervisor, HSE, job admin, and employee.
13. Add the worker mobile dashboard: clock in/out, assigned forms, training/SDS, offline outbox, and help contact.
14. Add the supervisor daily dashboard: active crews, no-show/late risk, evidence review, incidents, payroll exceptions, and route execution.
15. Add persistent health resolution workflow: assign, dismiss, retry, resolved, and dead-letter notes.
16. Add backup/restore automation scripts and a restore rehearsal checklist.
17. Add audit log viewer for auth, roles, posting, close/reopen, exports, approvals, and settings changes.
18. Add a CI deployment gate for syntax checks, smoke checks, asset references, H1 count, schema marker, and service-worker version.
19. Add public-page SEO automation when marketing pages are introduced: title/meta/H1/local words/alt/broken asset checks.
20. Add final production sign-off screen with RLS, CORS, env vars, backups, schema drift, monitoring, rate limits, roles, and recovery steps.

## SEO rule kept during this pass

Keep one clear H1 per exposed page. Use the terms people search for in page titles, main headings, alt text, and helpful link text. For local discovery, keep service area wording accurate and visible; local ranking is still driven by relevance, distance, and prominence.

References:
- Google Search Essentials: https://developers.google.com/search/docs/essentials
- Google title-link guidance: https://developers.google.com/search/docs/appearance/title-link
- Google Business Profile local ranking: https://support.google.com/business/answer/7091
