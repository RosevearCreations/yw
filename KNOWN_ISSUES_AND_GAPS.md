# Known Issues and Gaps

Last refreshed: **2026-05-14b**

## Highest priority after this pass

1. **Apply schema 107 live.** The live database must have the new schema drift/readiness/evidence/permission views before the new Admin panels can show real rows.
2. **Redeploy `admin-directory` and `admin-selectors`.** The function now avoids selecting `jobs.job_status` directly and loads the new readiness views.
3. **Guided Close Center is still read-only.** It shows blockers, but write actions still need endpoint support.
4. **Evidence Manager is still read-only.** Retry, replace, archive, and review actions are next.
5. **Saved filters table exists, but UI save/load actions are not complete yet.**
6. **Role permission matrix is visible, not yet enforced everywhere.** Keep RLS and Edge Function checks under review.
7. **Large admin tables still need server-side pagination.** This remains a performance priority.
8. **Production readiness checks are seeded as review items.** They need real pass/fail automation over time.
9. **Public SEO automation depends on future public pages.** The current app shell still has one H1.
10. **Accounting-close posting validation is still next.** Generated lines, period locks, and approvals need a full preview/post workflow.

## Recently addressed

- Fixed schema 106 live migration assumptions.
- Added schema 107.
- Added schema drift/readiness/permissions/close/evidence foundations.
- Removed active temp files.
- Archived legacy Markdown again.
- Updated smoke checks and documentation.

## Watch items after deploy

- Confirm no SQL error for `public.app_schema_versions`.
- Confirm no SQL/API error for `jobs.job_status`.
- Confirm Admin Health shows schema 107 as current.
- Confirm the new Admin panels render even with empty tables.
- Confirm old cached assets are not still loading.
