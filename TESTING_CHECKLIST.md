# Testing Checklist

Last refreshed: **2026-05-14b**

## Before deploy

- Run JavaScript syntax checks.
- Run `node scripts/repo-smoke-check.mjs`.
- Confirm `index.html` has no more than one H1.
- Confirm no active `test_write` files exist.
- Confirm retired root Markdown is archived, not active.
- Confirm schema 107 exists in `sql/` and `000_full_schema_reference.sql`.

## After deploy

- Apply schema 107.
- Redeploy `admin-directory`.
- Hard refresh browser/cache.
- Open Admin and test Command Center, Health, Task Inbox, Close Center, Evidence Manager, Readiness/Permissions.
- Confirm no `app_schema_versions` or `job_status` SQL errors.
